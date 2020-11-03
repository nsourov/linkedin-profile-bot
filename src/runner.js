import PQueue from "p-queue";

import { LinkedInProfileScraper } from "./lib/scraper";
import state from "./controllers/state";


const runner = async ({ urls, sessionCookieValue, instanceId, prisma }) => {
  const queue = new PQueue({ concurrency: 1 });

  const scraper = new LinkedInProfileScraper();
  scraper.options.sessionCookieValue = sessionCookieValue;
  await scraper.init();
  state.browsers += 1;

  urls.map((url) =>
    queue.add(async () => {
      await prisma.instance.update({
        where: { id: instanceId },
        data: {
          status: "running",
          runningUrl: url,
        },
      });
      const profileData = await scraper.run(url);
      await prisma.instance.update({
        where: {
          id: instanceId,
        },
        data: {
          profiles: {
            create: {
              url,
              info: {
                create: {
                  ...profileData.userProfile,
                  location: {
                    create: profileData.userProfile.location,
                  },
                },
              },
              experiences: {
                create: profileData.experiences.map((experience) => ({
                  ...experience,
                  location: {
                    create: experience.location,
                  },
                })),
              },
              education: {
                create: profileData.education,
              },
              skills: {
                create: profileData.skills,
              },
            },
          },
        },
      });
    })
  );

  await queue.onIdle();
  await scraper.close();
  await prisma.instance.update({
    where: { id: instanceId },
    data: {
      status: "finished",
      runningUrl: "",
    },
  });
  state.browsers -= 1;
};

export default runner;
