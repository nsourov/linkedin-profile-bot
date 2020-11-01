import puppeteer from "puppeteer-extra";
import pluginStealth from "puppeteer-extra-plugin-stealth";

import treeKill from "tree-kill";

import selectors from "./selectors";
import {
  getDurationInDays,
  formatDate,
  getCleanText,
  getLocationFromText,
  getHostname,
  getBlockedHosts,
  autoScroll,
  debugLog,
} from "../utils";

// Temporary fix for stealth plugin >= 2.40
// on puppeteer >= 3
// https://github.com/berstend/puppeteer-extra/issues/211
const pluginStealthInstance = pluginStealth();
pluginStealthInstance.onBrowser = () => {};
puppeteer.use(pluginStealthInstance);

export class LinkedInProfileScraper {
  constructor() {
    this.options = {
      sessionCookieValue: "",
      timeout: 10000,
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
      headless: false,
    };
    this.browser = null;
    this.page = null;
    this.logFnName = "contructor";
  }

  /**
   * Method to load Puppeteer in memory so we can re-use the browser instance.
   */

  log(message) {
    debugLog(`(${this.logFnName}): ${message || ""}`);
  }

  /**
   * Method to load Puppeteer in memory so we can re-use the browser instance.
   */
  async init() {
    this.logFnName = "setup";

    try {
      this.log(
        `launching browser in the ${
          this.options.headless ? "background" : "foreground"
        }...`
      );

      this.browser = await puppeteer.launch({
        headless: this.options.headless,
        executablePath: process.env.CHROME_PATH,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--proxy-server='direct://",
          "--proxy-bypass-list=*",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--disable-gpu",
          "--disable-features=site-per-process",
          "--enable-features=NetworkService",
          "--allow-running-insecure-content",
          "--enable-automation",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
          "--disable-web-security",
          "--autoplay-policy=user-gesture-required",
          "--disable-background-networking",
          "--disable-breakpad",
          "--disable-client-side-phishing-detection",
          "--disable-component-update",
          "--disable-default-apps",
          "--disable-domain-reliability",
          "--disable-extensions",
          "--disable-features=AudioServiceOutOfProcess",
          "--disable-hang-monitor",
          "--disable-ipc-flooding-protection",
          "--disable-notifications",
          "--disable-offer-store-unmasked-wallet-cards",
          "--disable-popup-blocking",
          "--disable-print-preview",
          "--disable-prompt-on-repost",
          "--disable-speech-api",
          "--disable-sync",
          "--disk-cache-size=33554432",
          "--hide-scrollbars",
          "--ignore-gpu-blacklist",
          "--metrics-recording-only",
          "--mute-audio",
          "--no-default-browser-check",
          "--no-first-run",
          "--no-pings",
          "--no-zygote",
          "--password-store=basic",
          "--use-gl=swiftshader",
          "--use-mock-keychain",
        ],
        timeout: this.options.timeout,
      });
    } catch (err) {
      // Kill Puppeteer
      await this.close();
      this.log("An error occurred during init scraper.");
      throw err;
    }
  }

  /**
   * Check if browser and page exists
   */

  async validateScraper(profileUrl) {
    if (!this.browser)
      throw new Error("Browser is not set. Please run the setup method first.");
    if (!profileUrl) throw new Error("No profileUrl given.");
    if (!this.page) await this.createPage();
    if (!profileUrl.includes("linkedin.com/")) {
      throw new Error("The given URL to scrape is not a linkedin.com url.");
    }
  }

  /**
   * Create a Puppeteer page with some extra settings to speed up the crawling process.
   */
  async createPage() {
    this.logFnName = "createPage";

    if (!this.browser) {
      throw new Error("Browser not set.");
    }

    // Important: Do not block "stylesheet", makes the crawler not work for LinkedIn
    const blockedResources = [
      "image",
      "media",
      "font",
      "texttrack",
      "object",
      "beacon",
      "csp_report",
      "imageset",
    ];

    try {
      this.page = await this.browser.newPage();

      // Method to create a faster Page
      // From: https://github.com/shirshak55/scrapper-tools/blob/master/src/fastPage/index.ts#L113
      const session = await this.page.target().createCDPSession();
      await this.page.setBypassCSP(true);
      await session.send("Page.enable");
      await session.send("Page.setWebLifecycleState", {
        state: "active",
      });

      this.log(`blocking the resources`);

      // A list of hostnames that are trackers
      // By blocking those requests we can speed up the crawling
      // This is kinda what a normal adblocker does, but really simple
      const blockedHosts = getBlockedHosts();
      const blockedResourcesByHost = ["script", "xhr", "fetch", "document"];

      // Block loading of resources, like images and css, we dont need that
      await this.page.setRequestInterception(true);

      this.page.on("request", (req) => {
        if (blockedResources.includes(req.resourceType())) {
          return req.abort();
        }

        const hostname = getHostname(req.url());

        // Block all script requests from certain host names
        if (
          blockedResourcesByHost.includes(req.resourceType()) &&
          hostname &&
          blockedHosts[hostname] === true
        ) {
          return req.abort();
        }

        return req.continue();
      });

      await this.page.setUserAgent(this.options.userAgent);

      await this.page.setViewport({
        width: 1200,
        height: 720,
      });

      this.log(`setting session cookie using cookie`);

      await this.page.setCookie({
        name: "li_at",
        value: this.options.sessionCookieValue,
        domain: ".www.linkedin.com",
      });
    } catch (err) {
      // Kill Puppeteer
      await this.close();

      this.log("An error occurred during page setup.");
      this.log(err.message);

      throw err;
    }
  }

  /**
   * Method to complete kill any Puppeteer process still active.
   * Freeing up memory.
   */
  async close() {
    this.logFnName = "close";
    return new Promise(async (resolve, reject) => {
      if (this.page) {
        try {
          this.log("closing page...");
          await this.closePage();
        } catch (err) {
          reject(err);
        }
      }

      if (this.browser) {
        try {
          this.log("closing browser...");
          await this.browser.close();

          const browserProcessPid = this.browser.process().pid;

          // Completely kill the browser process to prevent zombie processes
          // https://docs.browserless.io/blog/2019/03/13/more-observations.html#tip-2-when-you-re-done-kill-it-with-fire
          if (browserProcessPid) {
            this.log(`killing browser process pid: ${browserProcessPid}...`);

            treeKill(browserProcessPid, "SIGKILL", (err) => {
              if (err) {
                return reject(
                  `Failed to kill browser process pid: ${browserProcessPid}`
                );
              }
              resolve();
              this.browser = null;
            });
          }
        } catch (err) {
          reject(err);
        }
      }

      return resolve();
    });
  }

  /**
   * Simple method to check if the session is still active.
   */
  async checkIfLoggedIn() {
    this.logFnName = "checkIfLoggedIn";

    this.log("checking if we are still logged in...");

    const url = this.page.url();
    const isLoggedIn = !url.includes("/authwall") || !url.includes("/login");

    if (isLoggedIn) {
      this.log("all good, we are still logged in.");
    } else {
      const errorMessage =
        'Bad news, we are not logged in! Your session seems to be expired. Use your browser to login again with your LinkedIn credentials and extract the "li_at" cookie value for the "sessionCookieValue" option.';
      this.log(errorMessage);
      throw new SessionExpired(errorMessage);
    }
  }

  /**
   * Method to scrape a user profile.
   */
  async extractProfile() {
    this.logFnName = "extractProfile";
    this.log("parsing profile data...");

    const rawUserProfileData = await this.page.evaluate((selectors) => {
      const {
        data: { profile },
      } = selectors;
      const url = window.location.href;

      const profileSection = document.querySelector(
        selectors.data.profile.card
      );

      const fullNameElement =
        profileSection && profileSection.querySelector(profile.fullName);
      const fullName = fullNameElement && fullNameElement.textContent;

      const titleElement =
        profileSection && profileSection.querySelector(profile.title);
      const title = titleElement && titleElement.textContent;

      const descriptionElement = document.querySelector(profile.description);
      const description = descriptionElement && descriptionElement.textContent;

      const locationElement =
        profileSection && profileSection.querySelector(profile.location);
      const location = locationElement && locationElement.textContent;

      const photoElement =
        (profileSection && profileSection.querySelector(profile.photo.elem1)) ||
        profileSection.querySelector(profile.photo.elem2);
      const photo = photoElement && photoElement.getAttribute("src");

      return {
        fullName,
        title,
        description,
        location,
        photo,
        url,
      };
    }, selectors);

    // Convert the raw data to clean data using our utils
    // So we don't have to inject our util methods inside the browser context, which is too damn difficult using TypeScript
    const userProfile = {
      ...rawUserProfileData,
      fullName: getCleanText(rawUserProfileData.fullName),
      title: getCleanText(rawUserProfileData.title),
      location: rawUserProfileData.location
        ? getLocationFromText(rawUserProfileData.location)
        : null,
      description: getCleanText(rawUserProfileData.description),
    };
    return userProfile;
  }

  /**
   * Method to scrape a user experiences.
   */
  async extractExperience() {
    this.logFnName = "extractExperience";
    this.log("parsing experiences data...");

    const rawExperiencesData = await this.page.evaluate((selectors) => {
      const {
        data: { experience },
      } = selectors;
      const nodes = Array.from(document.querySelectorAll(experience.card));
      let data = [];
      for (const node of nodes) {
        const titleElement = node.querySelector(experience.title);
        const title = titleElement && titleElement.textContent;

        const employmentTypeElement = node.querySelector(
          experience.employmentType
        );
        const employmentType =
          employmentTypeElement && employmentTypeElement.textContent;

        const companyElement = node.querySelector(experience.company);
        const companyElementClean =
          companyElement && companyElement.querySelector("span")
            ? companyElement.removeChild(
                companyElement.querySelector("span")
              ) && companyElement
            : companyElement;
        const company = companyElementClean && companyElementClean.textContent;

        const descriptionElement = node.querySelector(experience.description);
        const description =
          descriptionElement && descriptionElement.textContent;

        const dateRangeElement = node.querySelector(experience.dateRange);
        const dateRangeText = dateRangeElement && dateRangeElement.textContent;

        const startDatePart = dateRangeText && dateRangeText.split("–")[0];
        const startDate = startDatePart && startDatePart.trim();

        const endDatePart = dateRangeText && dateRangeText.split("–")[1];
        const endDateIsPresent =
          (endDatePart && endDatePart.trim().toLowerCase() === "present") ||
          false;
        const endDate =
          endDatePart && !endDateIsPresent ? endDatePart.trim() : "Present";

        const locationElement = node.querySelector(experience.location);
        const location = locationElement?.textContent;

        data.push({
          title,
          company,
          employmentType,
          location,
          startDate,
          endDate,
          endDateIsPresent,
          description,
        });
      }
      return data;
    }, selectors);

    const experiences = rawExperiencesData.map((rawExperience) => {
      const startDate = formatDate(rawExperience.startDate);
      const endDate = formatDate(rawExperience.endDate) || null;
      const endDateIsPresent = rawExperience.endDateIsPresent;

      const durationInDaysWithEndDate =
        startDate && endDate && !endDateIsPresent
          ? getDurationInDays(startDate, endDate)
          : null;
      const durationInDaysForPresentDate =
        endDateIsPresent && startDate
          ? getDurationInDays(startDate, new Date())
          : null;
      const durationInDays = endDateIsPresent
        ? durationInDaysForPresentDate
        : durationInDaysWithEndDate;

      return {
        ...rawExperience,
        title: getCleanText(rawExperience.title),
        company: getCleanText(rawExperience.company),
        employmentType: getCleanText(rawExperience.employmentType),
        location: rawExperience?.location
          ? getLocationFromText(rawExperience.location)
          : null,
        startDate,
        endDate,
        endDateIsPresent,
        durationInDays,
        description: getCleanText(rawExperience.description),
      };
    });
    return experiences;
  }

  /**
   * Method to scrape a user education.
   */
  async extractEducation() {
    this.logFnName = "extractEducation";
    this.log("parsing education data...");

    const rawEducationData = await this.page.evaluate((selectors) => {
      const {
        data: { education },
      } = selectors;
      const nodes = Array.from(document.querySelectorAll(education.card));
      let data = [];
      for (const node of nodes) {
        const schoolNameElement = node.querySelector(education.schoolName);
        const schoolName = schoolNameElement && schoolNameElement.textContent;

        const degreeNameElement = node.querySelector(education.degreeName);
        const degreeName = degreeNameElement && degreeNameElement.textContent;

        const fieldOfStudyElement = node.querySelector(education.fieldOfStudy);
        const fieldOfStudy =
          fieldOfStudyElement && fieldOfStudyElement.textContent;

        const dateRangeElement = node.querySelectorAll(education.dateRange);

        const startDatePart =
          dateRangeElement &&
          dateRangeElement[0] &&
          dateRangeElement[0].textContent;
        const startDate = startDatePart;

        const endDatePart =
          dateRangeElement &&
          dateRangeElement[1] &&
          dateRangeElement[1].textContent;
        const endDate = endDatePart;

        data.push({
          schoolName,
          degreeName,
          fieldOfStudy,
          startDate,
          endDate,
        });
      }
      return data;
    }, selectors);

    const education = rawEducationData.map((rawEducation) => {
      const startDate = formatDate(rawEducation.startDate);
      const endDate = formatDate(rawEducation.endDate);

      return {
        ...rawEducation,
        schoolName: getCleanText(rawEducation.schoolName),
        degreeName: getCleanText(rawEducation.degreeName),
        fieldOfStudy: getCleanText(rawEducation.fieldOfStudy),
        startDate,
        endDate,
        durationInDays: getDurationInDays(startDate, endDate),
      };
    });
    return education;
  }

  /**
   * Method to scrape a user skills.
   */
  async extractSkill() {
    this.logFnName = "extractSkill";
    this.log("parsing skills data...");

    const skills = await this.page.evaluate((selectors) => {
      const {
        data: { skill },
      } = selectors;
      const nodes = Array.from(document.querySelectorAll(skill.card));
      let data = [];
      for (const node of nodes) {
        const skillName = node.querySelector(skill.name);
        const endorsementCount = node.querySelector(skill.endorsement);

        data.push({
          skillName: skillName ? skillName.textContent?.trim() : null,
          endorsementCount: endorsementCount
            ? parseInt(endorsementCount.textContent?.trim() || "0")
            : 0,
        });
      }
      return data;
    }, selectors);

    return skills;
  }

  /**
   * Close page
   */

  async closePage() {
    if (this.page) {
      await this.page.close();
    }
    this.page = null;
  }

  /**
   * Method to scrape a user profile.
   */
  async run(profileUrl) {
    this.logFnName = "run";

    await this.createPage();
    await this.validateScraper(profileUrl);

    try {
      this.log(`navigating to LinkedIn profile: ${profileUrl}`);

      await this.page.goto(profileUrl, {
        waitUntil: "networkidle2",
        timeout: this.options.timeout,
      });
      // check if still logged in or not
      await this.checkIfLoggedIn();
      this.log(
        "scrolling the page to the bottom, so all the data gets loaded into the page..."
      );

      await autoScroll(this.page);

      this.log('expanding all sections by clicking their "See more" buttons');

      const seemoreBtns = selectors.buttons.seemore;
      // Only click the expanding buttons when they exist
      for (const section of Object.keys(seemoreBtns)) {
        try {
          // await this.recursiveClick(page, seemoreBtns[section]);
          await this.page.click(seemoreBtns[section]);
        } catch (err) {
          this.log("see more button not exist");
        }
      }

      await this.page.waitFor(100);

      const userProfile = await this.extractProfile();
      const experiences = await this.extractExperience();
      const education = await this.extractEducation();
      const skills = await this.extractSkill();

      await this.closePage();
      return {
        userProfile,
        experiences,
        education,
        skills,
      };
    } catch (err) {
      await this.closePage();
      this.log("An error occurred during a run.");
      // Throw the error up, allowing the user to handle this error himself.
      throw err;
    }
  }
}
