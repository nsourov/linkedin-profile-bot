import { PrismaClient } from "@prisma/client";
import PQueue from "p-queue";

import { LinkedInProfileScraper } from "../lib/scraper";
import state from "./state";

const prisma = new PrismaClient();

const runner = async ({ names, sessionCookieValue, instanceId }) => {
  const queue = new PQueue({ concurrency: 1 });

  const scraper = new LinkedInProfileScraper();
  scraper.options.sessionCookieValue = sessionCookieValue;
  await scraper.init();
  state.browsers += 1;

  let isError = false;

  names.map((name) =>
    queue.add(async () => {
      try {
        await prisma.instance.update({
          where: { id: instanceId },
          data: {
            status: "running",
          },
        });

        const url = await scraper.extractProfileURL(name);
        if (url) {
          const profileData = await scraper.run();
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
        } else {
          throw new Error("User not found");
        }
      } catch (error) {
        console.error(error)
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
    },
  });
  state.browsers -= 1;
};

export default runner;
