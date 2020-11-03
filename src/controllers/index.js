import { PrismaClient } from "@prisma/client";

import runner from "../runner";
import state from "./state";

const prisma = new PrismaClient();

const BROWSER_LIMIT = Number(process.env.BROWSER_LIMIT) || 5;

export const startScraper = async (req, res) => {
  if (state.browsers === BROWSER_LIMIT || state.browsers > BROWSER_LIMIT) {
    return res.status(403).json({
      message: "Worker is busy. Please wait.",
    });
  }

  const { urls, sessionCookieValue } = req.body;
  if (typeof urls !== "object" || urls.length === 0) {
    return res.status(400).json({
      message: "Urls required",
    });
  }
  if (!sessionCookieValue) {
    return res.status(400).json({
      message: "Session cookie required",
    });
  }  

  const newInstance = await prisma.instance.create({
    data: {
      urls: { create: urls.map((url) => ({ url })) },
      status: "started",
    },
  });
  runner({
    urls,
    sessionCookieValue,
    instanceId: newInstance.id,
    prisma,
  });
  return res.json(newInstance);
};

export const resetDb = async (req, res) => {
  await Promise.all([
    prisma.profile.deleteMany({ where: { id: { not: "" } } }),
    prisma.location.deleteMany({ where: { id: { not: "" } } }),
    prisma.info.deleteMany({ where: { id: { not: "" } } }),
    prisma.experience.deleteMany({ where: { id: { not: "" } } }),
    prisma.education.deleteMany({ where: { id: { not: "" } } }),
    prisma.skill.deleteMany({ where: { id: { not: "" } } }),
    prisma.url.deleteMany({ where: { id: { not: "" } } }),
    prisma.instance.deleteMany({ where: { id: { not: "" } } }),
  ]);
  return res.json("All data from database are removed");
};

export const getInstance = async (req, res) => {
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
};
