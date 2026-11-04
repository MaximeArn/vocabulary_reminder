import { db } from "./db";
import { readSetting, writeSetting } from "./settingsRepository";

/**
 * Journal minimal des lancements de l'app.
 * Sert à vérifier, depuis l'écran Diagnostic, que les données survivent
 * à la fermeture de l'app et au redémarrage de l'iPhone.
 */

const FIRST_LAUNCH_KEY = "diagnostic.firstLaunchAt";
const LAUNCH_COUNT_KEY = "diagnostic.launchCount";

export interface LaunchInfo {
  firstLaunchAt: number;
  launchCount: number;
}

export async function recordLaunch(): Promise<void> {
  await db.transaction("rw", db.settings, async () => {
    const firstLaunchAt = await readSetting<number>(FIRST_LAUNCH_KEY);
    if (firstLaunchAt === undefined) {
      await writeSetting(FIRST_LAUNCH_KEY, Date.now());
    }
    const launchCount = (await readSetting<number>(LAUNCH_COUNT_KEY)) ?? 0;
    await writeSetting(LAUNCH_COUNT_KEY, launchCount + 1);
  });
}

export async function readLaunchInfo(): Promise<LaunchInfo | undefined> {
  const firstLaunchAt = await readSetting<number>(FIRST_LAUNCH_KEY);
  const launchCount = await readSetting<number>(LAUNCH_COUNT_KEY);
  if (firstLaunchAt === undefined || launchCount === undefined) return undefined;
  return { firstLaunchAt, launchCount };
}
