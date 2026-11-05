import { BalanceIt } from "../games/balance/BalanceIt";
import { ElementLab } from "../games/elements/ElementLab";
import { FactOrFiction } from "../games/facts/FactOrFiction";
import { GalaxyGuardian } from "../games/galaxy/GalaxyGuardian";
import { MatchSprint } from "../games/match/MatchSprint";
import { NumberRush } from "../games/rush/NumberRush";
import { useNav } from "../store/nav";
import { useSession } from "../store/session";

export function GameScreen() {
  const game = useNav((s) => s.game);
  const go = useNav((s) => s.go);
  const exit = () => {
    // Opened from the list during a round: back to that list, one step from the round.
    if (useSession.getState().pausedAt !== null) {
      window.history.back();
      return;
    }
    go("home");
    setTimeout(() => document.getElementById("games")?.scrollIntoView({ block: "start" }), 300);
  };
  return (
    <div className="paper min-h-dvh">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        {game === "galaxy" && <GalaxyGuardian onExit={exit} />}
        {game === "rush" &&<NumberRush onExit={exit} />}
        {game === "match" && <MatchSprint onExit={exit} />}
        {game === "balance" && <BalanceIt onExit={exit} />}
        {game === "facts" && <FactOrFiction onExit={exit} />}
        {game === "elements" && <ElementLab onExit={exit} />}
      </div>
    </div>
  );
}
