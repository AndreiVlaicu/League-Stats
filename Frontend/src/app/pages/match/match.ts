import { Component, inject, signal, Pipe, PipeTransform } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { RiotApiService } from '../../core/riot-api';
import {
  ChampionService,
  ChampionData,
  SummonerSpellData,
  ItemData,
} from '../../core/services/champion.service';
import { QUEUE_NAMES } from '../../core/regions';

type TeamId = 100 | 200;

type KillEventVM = {
  minute: number;
  killer: any | null;
  victim: any | null;
  assists: any[];
};

type ObjectiveEventVM = {
  minute: number;
  kind: 'DRAGON' | 'BARON' | 'HERALD' | 'TOWER' | 'INHIB' | 'OTHER';
  text: string;
  killer?: any | null;
  teamId?: TeamId | null;
};

@Pipe({
  name: 'filter',
  standalone: true,
})
export class FilterPipe implements PipeTransform {
  transform(items: any[], property: string, value: any): any[] {
    if (!items || !property) return items || [];
    return items.filter((item) => item[property] === value);
  }
}

@Component({
  standalone: true,
  selector: 'app-match',
  imports: [CommonModule, FilterPipe],
  templateUrl: './match.html',
  styleUrls: ['./match.css'],
})
export class MatchComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);

  private riot = inject(RiotApiService);
  private champs = inject(ChampionService);

  loading = signal(false);
  error = signal<string | null>(null);

  data = signal<any>(null);
  player = signal<any>(null);

  routing = signal<string>('europe');
  matchId = signal<string>('');
  puuid = signal<string>('');
  region = signal<string>('EUW');
  ddVersion = signal<string>('');

  championsByKey = signal<Record<string, ChampionData>>({});
  spellsByKey = signal<Record<string, SummonerSpellData>>({});
  itemsById = signal<Record<string, ItemData>>({});

  goldSeries = signal<{ minute: number; blueGold: number; redGold: number; diff: number }[]>([]);
  // ✅ team info & aggregates
  teams = signal<Record<number, any>>({});
  teamAgg = signal<Record<number, { kills: number; gold: number; dmg: number }>>({
    100: { kills: 0, gold: 0, dmg: 0 },
    200: { kills: 0, gold: 0, dmg: 0 },
  });

  // ✅ timeline feed
  killFeed = signal<KillEventVM[]>([]);
  objectiveFeed = signal<ObjectiveEventVM[]>([]);
  timelineExpanded = signal<boolean>(false);

  ngOnInit() {
    // preload DataDragon
    this.champs.getVersion().subscribe({
      next: (v) => this.ddVersion.set(v),
      error: () => this.ddVersion.set(this.champs.getVersionSync()),
    });

    this.champs.getChampionsByKey().subscribe({
      next: (m) => this.championsByKey.set(m),
      error: () => this.championsByKey.set({}),
    });

    this.champs.getSummonerSpellsByKey().subscribe({
      next: (m) => this.spellsByKey.set(m),
      error: () => this.spellsByKey.set({}),
    });

    this.champs.getItemsById().subscribe({
      next: (m) => this.itemsById.set(m),
      error: () => this.itemsById.set({}),
    });

    this.route.paramMap.subscribe((pm) => {
      this.routing.set(pm.get('routing') ?? 'europe');
      const matchId = pm.get('matchId') ?? '';
      this.matchId.set(matchId);
      this.puuid.set(pm.get('puuid') ?? '');

      const prefix = matchId.split('_')[0].toUpperCase();
      const regionMap: Record<string, string> = {
        EUW1: 'EUW',
        EUN1: 'EUNE',
        NA1: 'NA',
        KR: 'KR',
        BR1: 'BR',
        JP1: 'JP',
        OC1: 'OCE',
        TR1: 'TR',
        RU: 'RU',
        LA1: 'LAN',
        LA2: 'LAS',
      };

      this.region.set(regionMap[prefix] || 'EUW');

      this.load();
    });
  }

  back() {
    this.location.back();
  }

  home() {
    this.router.navigate(['/']);
  }

  toggleTimeline() {
    this.timelineExpanded.set(!this.timelineExpanded());
  }
  private platformFromRegion(region: string): string | null {
    const r = (region || '').toUpperCase();
    const map: Record<string, string> = {
      EUW: 'euw1',
      EUNE: 'eun1',
      NA: 'na1',
      KR: 'kr',
      BR: 'br1',
      JP: 'jp1',
      OCE: 'oc1',
      TR: 'tr1',
      RU: 'ru',
      LAN: 'la1',
      LAS: 'la2',
    };
    return map[r] ?? null;
  }
  openParticipantProfile(participant: any) {
    const region = (this.region() || 'EUW').toUpperCase();

    const gameName = (participant?.riotIdGameName || '').trim();
    const tagLine = (participant?.riotIdTagLine || '').trim();

    // 1) Cel mai bine: avem Riot ID direct din match-v5
    if (gameName && tagLine) {
      this.router.navigate(['/summoner', region, gameName, tagLine]);
      return;
    }

    // 2) Fallback: avem puuid
    const puuid = participant?.puuid;
    if (puuid) {
      this.router.navigate(['/summoner-puuid', region, puuid]);
      return;
    }

    // 3) Ultim fallback: avem summonerId -> luăm puuid via Summoner-V4
    const summonerId = participant?.summonerId;
    const platform = this.platformFromRegion(region);

    if (summonerId && platform) {
      this.riot.summonerBySummonerId(platform, summonerId).subscribe({
        next: (s) => {
          if (s?.puuid) {
            this.router.navigate(['/summoner-puuid', region, s.puuid]);
          } else {
            this.error.set("Couldn't open the profile (missing puuid and the lookup failed).");
          }
        },
        error: () => {
          this.error.set("Couldn't open the profile (missing puuid and the lookup failed).");
        },
      });
      return;
    }

    // 4) Nimic disponibil
    this.error.set("Couldn't open the profile (missing Riot ID and puuid).");
  }

  private ddVer(): string {
    return this.ddVersion() || this.champs.getVersionSync() || '14.1.1';
  }

  queueName(queueId?: number) {
    if (!queueId) return 'Unknown queue';
    return QUEUE_NAMES[queueId] ?? `Queue ${queueId}`;
  }

  champName(championId?: number) {
    return this.champs.championNameByNumericKeySync(championId ?? 0, this.championsByKey());
  }

  champIconUrl(championId?: number) {
    const url = this.champs.championSquareUrlByNumericKeySync(
      championId ?? 0,
      this.championsByKey(),
      this.ddVer()
    );
    return url || null;
  }

  spellIconUrl(spellKey?: number) {
    const url = this.champs.spellIconUrlByNumericKeySync(
      spellKey ?? 0,
      this.spellsByKey(),
      this.ddVer()
    );
    return url || null;
  }

  spellTitle(spellKey?: number) {
    return this.champs.spellNameByNumericKeySync(spellKey ?? 0, this.spellsByKey());
  }

  itemIconUrl(itemId?: number) {
    const url = this.champs.getItemImageUrl(itemId ?? 0, this.ddVer());
    return url || null;
  }

  itemTitle(itemId?: number) {
    const id = String(itemId ?? 0);
    const name = this.itemsById()?.[id]?.name;
    return name ? `${name} (${id})` : `Item ${id}`;
  }

  itemIds(p: any): number[] {
    return [p?.item0, p?.item1, p?.item2, p?.item3, p?.item4, p?.item5, p?.item6]
      .map((x: any) => Number(x ?? 0))
      .filter((x) => !!x && x > 0);
  }

  cs(p: any): number {
    const lane = Number(p?.totalMinionsKilled ?? 0);
    const jungle = Number(p?.neutralMinionsKilled ?? 0);
    return lane + jungle;
  }

  playerName(p: any | null): string {
    if (!p) return 'Unknown';
    return p?.riotIdGameName || p?.summonerName || 'Player';
  }

  getPlayerDisplayName(p: any): string {
    const gameName = p?.riotIdGameName || p?.summonerName || 'Player';
    const tagLine = p?.riotIdTagLine;

    if (gameName && tagLine) {
      return `${gameName}#${tagLine}`;
    }
    return gameName;
  }

  private toMinute(ts?: number): number {
    const t = Number(ts ?? 0);
    return Math.floor(t / 60000);
  }

  private laneShort(lane?: string): string {
    const x = (lane ?? '').toUpperCase();
    if (x.includes('TOP')) return 'TOP';
    if (x.includes('MID')) return 'MID';
    if (x.includes('BOT')) return 'BOT';
    return lane ?? '';
  }

  private teamName(teamId?: number): string {
    return teamId === 100 ? 'Blue' : teamId === 200 ? 'Red' : 'Unknown';
  }
  private prettyDragonSubType(sub?: string): string {
    const s = (sub ?? '').toUpperCase();
    const map: Record<string, string> = {
      CHEMTECH_DRAGON: 'Chemtech Dragon',
      HEXTECH_DRAGON: 'Hextech Dragon',
      FIRE_DRAGON: 'Infernal Dragon',
      WATER_DRAGON: 'Ocean Dragon',
      AIR_DRAGON: 'Cloud Dragon',
      EARTH_DRAGON: 'Mountain Dragon',
      ELDER_DRAGON: 'Elder Dragon',
    };
    return map[s] ?? (sub ? sub.replaceAll('_', ' ') : 'Dragon');
  }

  private prettyTowerType(towerType?: string): string {
    if (!towerType) return 'TOWER';
    // ex: TOP_OUTER_TURRET -> TOP OUTER
    return towerType.replaceAll('_TURRET', '').replaceAll('_', ' ');
  }

  private prettyLane(laneType?: string): string {
    const s = (laneType ?? '').toUpperCase();
    if (s.includes('TOP')) return 'TOP';
    if (s.includes('MID')) return 'MID';
    if (s.includes('BOT')) return 'BOT';
    return laneType ? laneType.replaceAll('_', ' ') : '';
  }

  private prettyMonster(ev: any): { kind: any; label: string } {
    const monsterType = (ev?.monsterType ?? '').toUpperCase();
    const sub = (ev?.monsterSubType ?? '').toUpperCase();

    if (monsterType === 'DRAGON') {
      return { kind: 'DRAGON', label: this.prettyDragonSubType(sub) };
    }
    if (monsterType === 'BARON_NASHOR') {
      return { kind: 'BARON', label: 'Baron Nashor' };
    }
    if (monsterType === 'RIFTHERALD') {
      return { kind: 'HERALD', label: 'Rift Herald' };
    }

    // ✅ În timeline apare des ca "HORDE" (de obicei Voidgrubs: 3 event-uri la minutul ~6)
    if (monsterType === 'HORDE') {
      return { kind: 'OTHER', label: 'Voidgrub' };
    }

    // ✅ Unele patch-uri noi pot avea "ATAKHAN" ca neutral objective
    if (monsterType === 'ATAKHAN') {
      return { kind: 'OTHER', label: 'Atakhan' };
    }

    return { kind: 'OTHER', label: monsterType ? monsterType.replaceAll('_', ' ') : 'Objective' };
  }

  private buildTimelineFeeds(match: any, timeline: any) {
    // reset
    this.killFeed.set([]);
    this.objectiveFeed.set([]);

    if (!match || !timeline?.info?.frames?.length) return;

    const participants: any[] = match?.info?.participants ?? [];
    const pByParticipantId: Record<number, any> = {};
    for (const p of participants) {
      if (p?.participantId) pByParticipantId[Number(p.participantId)] = p;
    }

    const kills: KillEventVM[] = [];
    const objs: ObjectiveEventVM[] = [];

    for (const frame of timeline.info.frames ?? []) {
      for (const ev of frame?.events ?? []) {
        const type = ev?.type;

        // --- kills ---
        if (type === 'CHAMPION_KILL') {
          const killer = pByParticipantId[Number(ev.killerId)] ?? null;
          const victim = pByParticipantId[Number(ev.victimId)] ?? null;
          const assists = (ev.assistingParticipantIds ?? [])
            .map((id: any) => pByParticipantId[Number(id)] ?? null)
            .filter(Boolean);

          kills.push({
            minute: this.toMinute(ev.timestamp),
            killer,
            victim,
            assists,
          });
          continue;
        }

        // --- objectives: dragons/baron/herald ---
        /* if (type === 'ELITE_MONSTER_KILL') {
          const killer = pByParticipantId[Number(ev.killerId)] ?? null;
          const monsterType = ev?.monsterType ?? '';
          const monsterSubType = ev?.monsterSubType ?? '';

          let kind: ObjectiveEventVM['kind'] = 'OTHER';
          let label = monsterType;

          if (monsterType === 'DRAGON') {
            kind = 'DRAGON';
            label = monsterSubType ? `Dragon (${monsterSubType})` : 'Dragon';
          } else if (monsterType === 'BARON_NASHOR') {
            kind = 'BARON';
            label = 'Baron Nashor';
          } else if (monsterType === 'RIFTHERALD') {
            kind = 'HERALD';
            label = 'Rift Herald';
          }

          const teamId = (killer?.teamId as TeamId) ?? null;

          objs.push({
            minute: this.toMinute(ev.timestamp),
            kind,
            text: `${label} — ${teamId ? this.teamName(teamId) : 'Unknown team'}`,
            killer,
            teamId,
          });
          continue;
        }*/
        if (type === 'ELITE_MONSTER_KILL') {
          const killer = pByParticipantId[Number(ev.killerId)] ?? null;

          const { kind, label } = this.prettyMonster(ev);

          const teamId = (killer?.teamId as TeamId) ?? null;

          objs.push({
            minute: this.toMinute(ev.timestamp),
            kind,
            text: `${label} — ${teamId ? this.teamName(teamId) : 'Unknown team'}`,
            killer,
            teamId,
          });
          continue;
        }

        // --- objectives: towers/inhibs ---
        /*if (type === 'BUILDING_KILL') {
          const killer = pByParticipantId[Number(ev.killerId)] ?? null;
          const buildingType = ev?.buildingType ?? '';
          const laneType = ev?.laneType ?? '';
          const towerType = ev?.towerType ?? '';
          const destroyedTeam = ev?.teamId as TeamId | undefined; // de obicei echipa clădirii distruse

          const lane = this.laneShort(laneType);

          if (buildingType === 'TOWER_BUILDING') {
            objs.push({
              minute: this.toMinute(ev.timestamp),
              kind: 'TOWER',
              text: `Tower (${lane} ${towerType || ''}) destroyed — ${
                destroyedTeam ? this.teamName(destroyedTeam) : 'Unknown'
              }`,
              killer,
              teamId: destroyedTeam ?? null,
            });
          } else if (buildingType === 'INHIBITOR_BUILDING') {
            objs.push({
              minute: this.toMinute(ev.timestamp),
              kind: 'INHIB',
              text: `Inhibitor (${lane}) destroyed — ${
                destroyedTeam ? this.teamName(destroyedTeam) : 'Unknown'
              }`,
              killer,
              teamId: destroyedTeam ?? null,
            });
          }
          continue;
        }*/

        if (type === 'BUILDING_KILL') {
          const killer = pByParticipantId[Number(ev.killerId)] ?? null;
          const buildingType = ev?.buildingType ?? '';
          const lane = this.prettyLane(ev?.laneType);
          const destroyedTeam = ev?.teamId as TeamId | undefined;

          if (buildingType === 'TOWER_BUILDING') {
            const tw = this.prettyTowerType(ev?.towerType);
            objs.push({
              minute: this.toMinute(ev.timestamp),
              kind: 'TOWER',
              text: `Tower (${lane} ${tw}) destroyed — ${
                destroyedTeam ? this.teamName(destroyedTeam) : 'Unknown'
              }`,
              killer,
              teamId: destroyedTeam ?? null,
            });
          } else if (buildingType === 'INHIBITOR_BUILDING') {
            objs.push({
              minute: this.toMinute(ev.timestamp),
              kind: 'INHIB',
              text: `Inhibitor (${lane}) destroyed — ${
                destroyedTeam ? this.teamName(destroyedTeam) : 'Unknown'
              }`,
              killer,
              teamId: destroyedTeam ?? null,
            });
          }
          continue;
        }
      }
    }

    // sort by time
    kills.sort((a, b) => a.minute - b.minute);
    objs.sort((a, b) => a.minute - b.minute);

    // (optional) limit ca să nu fie gigant
    this.killFeed.set(kills.slice(-40));
    this.objectiveFeed.set(objs.slice(-40));
  }

  // ✅ LOAD: match + timeline (păstrăm tot ce aveai + adăugăm timeline)
  private buildGoldSeries(match: any, timeline: any) {
    this.goldSeries.set([]);
    if (!match || !timeline?.info?.frames?.length) return;

    const participants: any[] = match?.info?.participants ?? [];
    const teamByParticipantId: Record<number, TeamId> = {};
    for (const p of participants) {
      if (p?.participantId) teamByParticipantId[Number(p.participantId)] = p.teamId;
    }

    const points: { minute: number; blueGold: number; redGold: number; diff: number }[] = [];

    for (const frame of timeline.info.frames ?? []) {
      const minute = this.toMinute(frame.timestamp);
      const pf = frame.participantFrames ?? {};

      let blue = 0;
      let red = 0;

      for (const pidStr of Object.keys(pf)) {
        const pid = Number(pidStr);
        const tid = teamByParticipantId[pid];
        const totalGold = Number(pf[pidStr]?.totalGold ?? 0);

        if (tid === 100) blue += totalGold;
        else if (tid === 200) red += totalGold;
      }

      points.push({ minute, blueGold: blue, redGold: red, diff: blue - red });
    }

    // uneori sunt minute duplicate (frame-uri), le “compactăm” (păstrăm ultima valoare pe minut)
    const compact = new Map<number, any>();
    for (const p of points) compact.set(p.minute, p);
    this.goldSeries.set(Array.from(compact.values()).sort((a, b) => a.minute - b.minute));
  }

  private load() {
    const routing = this.routing();
    const matchId = this.matchId();
    const puuid = this.puuid();

    if (!routing || !matchId) return;

    this.loading.set(true);
    this.error.set(null);
    this.data.set(null);
    this.player.set(null);
    this.teams.set({});
    this.teamAgg.set({
      100: { kills: 0, gold: 0, dmg: 0 },
      200: { kills: 0, gold: 0, dmg: 0 },
    });
    this.killFeed.set([]);
    this.objectiveFeed.set([]);

    forkJoin({
      match: this.riot.matchById(routing, matchId),
      timeline: this.riot.matchTimelineById(routing, matchId).pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ match, timeline }) => {
        // ✅ păstrăm structura data() + adăugăm timeline
        const res = { match, timeline };
        this.data.set(res);

        // player highlight
        const p = match?.info?.participants,
          any: any[] = match?.info?.participants ?? [];
        const me = p.find((x: any) => x?.puuid === puuid) ?? null;
        this.player.set(me);

        // teams map
        const tmap: Record<number, any> = {};
        for (const t of match?.info?.teams ?? []) tmap[t.teamId] = t;
        this.teams.set(tmap);

        // team aggregates (kills/gold/dmg)
        const agg: any = {
          100: { kills: 0, gold: 0, dmg: 0 },
          200: { kills: 0, gold: 0, dmg: 0 },
        };

        for (const pp of match?.info?.participants ?? []) {
          const tid = (pp?.teamId ?? 0) as TeamId;
          if (tid !== 100 && tid !== 200) continue;
          agg[tid].kills += Number(pp?.kills ?? 0);
          agg[tid].gold += Number(pp?.goldEarned ?? 0);
          agg[tid].dmg += Number(pp?.totalDamageDealtToChampions ?? 0);
        }
        this.teamAgg.set(agg);

        // ✅ timeline feeds
        this.buildTimelineFeeds(match, timeline);
        this.buildGoldSeries(match, timeline);

        this.loading.set(false);
      },
      error: (err) => {
        const body =
          typeof err?.error === 'string'
            ? err.error.slice(0, 160)
            : JSON.stringify(err?.error ?? {}).slice(0, 160);

        this.error.set(
          `HTTP ${err?.status ?? ''} ${err?.statusText ?? ''} | ${err?.message ?? ''} | ${body}`
        );
        this.loading.set(false);
      },
    });
  }
}
