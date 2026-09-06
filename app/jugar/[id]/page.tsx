import { notFound } from "next/navigation";
import GamePlayer from "@/components/GamePlayer";
import { GAMES } from "@/lib/data";

export default async function GamePlayerPage(props: PageProps<"/jugar/[id]">) {
  const { id } = await props.params;
  const game = GAMES.find((g) => g.id === id);
  if (!game) notFound();

  return <GamePlayer game={game} />;
}
