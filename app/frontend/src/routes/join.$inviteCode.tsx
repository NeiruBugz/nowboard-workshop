import { createFileRoute } from "@tanstack/react-router";

import { JoinPage } from "@/pages/join";

export const Route = createFileRoute("/join/$inviteCode")({
  component: JoinRoute,
});

function JoinRoute() {
  const { inviteCode } = Route.useParams();
  return <JoinPage inviteCode={inviteCode} />;
}
