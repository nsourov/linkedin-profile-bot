import express from "express";
import { PrismaClient } from "@prisma/client";

import runner, { LinkedInProfileScraper } from "./runner";

const app = express();

const scraper = new LinkedInProfileScraper();
const prisma = new PrismaClient();

app.get("/start", async (req, res) => {
  const urls = [
    "https://www.linkedin.com/in/naimur-rahman-sourov-a00b1b13a/",
    "https://www.linkedin.com/in/alanjmonaghan/",
    // "https://www.linkedin.com/in/naimur-rahman-sourov-a00b1b13a/",
  ];
  const sessionCookieValue = process.env.LINKEDIN_SESSION_COOKIE_VALUE;

  scraper.options.sessionCookieValue = sessionCookieValue;

  if (!scraper.browser) {
    await scraper.init();
  }

  const newInstance = await prisma.instance.create({
    data: {
      urls: { create: urls.map((url) => ({ url })) },
      status: "started",
    },
  });
  runner({
    urls,
    scraper,
    instanceId: newInstance.id,
    prisma,
  });
  return res.json(newInstance);
});

app.delete("/reset", async (req, res) => {
  await prisma.profile.deleteMany({ where: { id: { not: "" } } });
  await prisma.location.deleteMany({ where: { id: { not: "" } } });
  await prisma.info.deleteMany({ where: { id: { not: "" } } });
  await prisma.experience.deleteMany({ where: { id: { not: "" } } });
  await prisma.education.deleteMany({ where: { id: { not: "" } } });
  await prisma.skill.deleteMany({ where: { id: { not: "" } } });
  await prisma.url.deleteMany({ where: { id: { not: "" } } });
  await prisma.instance.deleteMany({ where: { id: { not: "" } } });
  return res.json("All data from database are removed");
});

app.get("/instance/:instanceId", async (req, res) => {
  const instance = await prisma.instance.findOne({
    where: { id: req.params.instanceId },
    include: {
      profiles: {
        include: {
          info: true,
          education: true,
          experiences: true,
          skills: true,
        },
      },
    },
  });
  if (!instance) {
    return res.status(404).json({
      message: "Instance not found",
    });
  }
  return res.json(instance);
});

const port = process.env.PORT || 3000;
app.listen(port, () =>
  console.log(`api is running on http://localhost:${port}`)
);
