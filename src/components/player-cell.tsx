import type { CfbTeamIdentity } from "@/lib/types";
import { PlayerHeadshot } from "@/components/player-headshot";
import { cfbPlayerHeadshotUrl } from "@/lib/player-headshots";
import { TeamLogo } from "@/components/team-logo";

// Headshot, name and team line for a college player, shared by the Heisman
// tracker and the player grades.
export function PlayerCell({
  athleteId,
  name,
  team,
  position,
  logo,
}: {
  athleteId: string;
  name: string;
  team: string;
  position: string | null;
  logo: CfbTeamIdentity | undefined;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <PlayerHeadshot name={name} src={cfbPlayerHeadshotUrl(athleteId)} className="h-9 w-9" />
      <div className="min-w-0">
        <div className="truncate font-medium">{name}</div>
        <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          <TeamLogo team={logo} name={team} className="h-3.5 w-3.5" />
          <span className="truncate">
            {team}
            {position ? ` · ${position}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
