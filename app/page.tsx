import type { Metadata } from "next";
import MoonExperience from "./MoonExperience";

export const metadata: Metadata = {
  title: "SELENE — A Living Observatory of the Lunar Cycle",
  description:
    "Explore the lunar cycle through a cinematic, interactive three-dimensional Moon.",
};

export default function Home() {
  return <MoonExperience />;
}
