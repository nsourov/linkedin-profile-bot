import { PrismaClient } from "@prisma/client";
import PQueue from "p-queue";

import { LinkedInProfileScraper } from "../lib/scraper";
import state from "./state";

const prisma = new PrismaClient();

const runner = async ({ urls, sessionCookieValue, instanceId }) => {
  const queue = new PQueue({ concurrency: 1 });

  const scraper = new LinkedInProfileScraper();
  scraper.options.sessionCookieValue = sessionCookieValue;
  await scraper.init();
  state.browsers += 1;

  let isError = false;

  urls.map((url) =>
    queue.add(async () => {
      try {
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
      } catch (error) {
        await prisma.instance.update({
          where: { id: instanceId },
          data: {
            error: error.message,
          },
        });
        isError = true;
      }
    })
  );

  await queue.onIdle();
  await scraper.close();
  await prisma.instance.update({
    where: { id: instanceId },
    data: {
      status: isError ? "stopped" : "finished",
      runningUrl: "",
    },
  });
  state.browsers -= 1;
};

export default runner;
