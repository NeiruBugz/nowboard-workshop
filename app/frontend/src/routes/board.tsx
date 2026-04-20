import { createFileRoute } from "@tanstack/react-router";

import { BoardPage } from "@/pages/board";

export const Route = createFileRoute("/board")({
  component: BoardPage,
});
