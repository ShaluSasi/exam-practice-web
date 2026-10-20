import { BalanceIt } from "../games/balance/BalanceIt";
import { FactOrFiction } from "../games/facts/FactOrFiction";
import { GalaxyGuardian } from "../games/galaxy/GalaxyGuardian";
import { NumberRush } from "../games/rush/NumberRush";
import { useNav } from "../store/nav";

export function GameScreen() {
  const game = useNav((s) => s.game);
  const go = useNav((s) => s.go);
  const exit = () => {
    go("home");
    setTimeout(() => document.getElementById("games")?.scrollIntoView({ block: "start" }), 300);
  };
  return (
    <div className="paper min-h-dvh">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        {game === "galaxy" && <GalaxyGuardian onExit={exit} />}
        {game === "rush" &&<NumberRush onExit={exit} />}
        {game === "balance" && <BalanceIt onExit={exit} />}
        {game === "facts" && <FactOrFiction onExit={exit} />}
      </div>
    </div>
  );
}
