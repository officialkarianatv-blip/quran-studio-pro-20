import { createFileRoute } from "@tanstack/react-router";
import { Workspace } from "@/components/studio/Workspace";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Studio Al-Qalam — Quranic DTP Workspace" },
      {
        name: "description",
        content:
          "Studio Al-Qalam: a desktop publishing workspace for high-precision Quranic page layout and print export.",
      },
    ],
  }),
});

function Index() {
  return <Workspace />;
}
