import moment from "moment-timezone";
import countries from "i18n-iso-countries";
import cities from "all-the-cities";
import debug from "debug";

import blockedHostsList from "../lib/blocked-hosts";

export const debugLog = debug("scraper");

export const getIsCountry = (text) => {
  const countriesList = Object.values(countries.getNames("en"));
  const lowerCaseText = text.toLowerCase();
  // Some custom text that we assume is also a country (lower cased)
  // But is not detected correctly by the iso-countries module
  if (["united states", "the netherlands"].includes(lowerCaseText)) {
    return true;
  }
  return !!countriesList.find(
    (country) => country.toLowerCase() === lowerCaseText
  );
};

export const getIsCity = (text) => {
  const lowerCaseText = text.toLowerCase();
  if (["new york"].includes(lowerCaseText)) {
    return true;
  }
  return !!cities.find((city) => city.name.toLowerCase() === lowerCaseText);
};

export const formatDate = (date) => {
  if (date === "Present") {
    return moment().format();
  }
  return moment(date, "MMMY").format();
};

export const getDurationInDays = (formattedStartDate, formattedEndDate) => {
  if (!formattedStartDate || !formattedEndDate) return null;
  // +1 to include the start date
  return moment(formattedEndDate).diff(moment(formattedStartDate), "days") + 1;
};

export const getLocationFromText = (text) => {
  // Text is something like: Amsterdam Oud-West, North Holland Province, Netherlands
  if (!text) return null;
  const cleanText = text.replace(" Area", "").trim();
  const parts = cleanText.split(", ");

  let city;
  let province;
  let country;

  // If there are 3 parts, we can be sure of the order of each part
  // So that must be a: city, province/state and country
  if (parts.length === 3) {
    city = parts[0];
    province = parts[1];
    country = parts[2];

    return {
      city,
      province,
      country,
    };
  }

  // If we only have 2 parts, we don't know exactly what each part is;
  // it could still be: city, province/state or a country
  // For example: Sacramento, California Area
  if (parts.length === 2) {
    // 2 possible scenario's are most likely. We strictly check for the following:
    // first: city + country
    // second: city + province/state

    if (getIsCity(parts[0]) && getIsCountry(parts[1])) {
      return {
        city: parts[0],
        province,
        country: parts[1],
      };
    }

    // If the second part is NOT a country, it's probably a province/state
    if (getIsCity(parts[0]) && !getIsCountry(parts[1])) {
      return {
        city: parts[0],
        province: parts[1],
        country,
      };
    }

    return {
      city,
      province: parts[0],
      country: parts[1],
    };
  }

  // If we only have one part we'll end up here
  // Just find out if it's one of: city, province/state or country
  if (getIsCountry(parts[0])) {
    return {
      city,
      province,
      country: parts[0],
    };
  }

  if (getIsCity(parts[0])) {
    return {
      city: parts[0],
      province,
      country,
    };
  }

  // Else, it must be a province/state. We just don't know and assume it is.
  return {
    city,
    province: parts[0],
    country,
  };
};

export const getCleanText = (text) => {
  const regexRemoveMultipleSpaces = / +/g;
  const regexRemoveLineBreaks = /(\r\n\t|\n|\r\t)/gm;

  if (!text) return null;

  const cleanText = text
    .replace(regexRemoveLineBreaks, "")
    .replace(regexRemoveMultipleSpaces, " ")
    .replace("...", "")
    .replace("See more", "")
    .replace("See less", "")
    .trim();

  return cleanText;
};

export const autoScroll = async (page) => {
  await page.evaluate(() => {
    return new Promise((resolve, reject) => {
      var totalHeight = 0;
      var distance = 500;
      var timer = setInterval(() => {
        var scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
};

export const getHostname = (url) => {
  return new URL(url).hostname;
};

/**
 * Method to block know hosts that have some kind of tracking.
 * By blocking those hosts we speed up the crawling.
 *
 * More info: http://winhelp2002.mvps.org/hosts.htm
 */
export const getBlockedHosts = () => {
  const blockedHostsArray = blockedHostsList.split("\n");

  let blockedHostsObject = blockedHostsArray.reduce((prev, curr) => {
    const frags = curr.split(" ");

    if (frags.length > 1 && frags[0] === "0.0.0.0") {
      prev[frags[1].trim()] = true;
    }

    return prev;
  }, {});

  blockedHostsObject = {
    ...blockedHostsObject,
    "static.chartbeat.com": true,
    "scdn.cxense.com": true,
    "api.cxense.com": true,
    "www.googletagmanager.com": true,
    "connect.facebook.net": true,
    "platform.twitter.com": true,
    "tags.tiqcdn.com": true,
    "dev.visualwebsiteoptimizer.com": true,
    "smartlock.google.com": true,
    "cdn.embedly.com": true,
  };

  return blockedHostsObject;
};
