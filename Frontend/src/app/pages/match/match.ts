import { Component, inject, signal } from '@angular/core';
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

@Component({
  standalone: true,
  selector: 'app-match',
  imports: [CommonModule],
  template: `
    <div style="padding:16px">
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:12px;">
        <button (click)="back()">Înapoi</button>
        <button (click)="home()">Home</button>
      </div>

      <h2>Match Details</h2>

      <p *ngIf="loading()">Loading...</p>
      <p *ngIf="error()">{{ error() }}</p>

      <div *ngIf="data() as d">
        <p>
          <b>Queue:</b> {{ queueName(d.match?.info?.queueId) }}
          &nbsp;|&nbsp;
          <b>Duration:</b> {{ (d.match?.info?.gameDuration ?? 0) / 60 | number : '1.0-0' }} min
          &nbsp;|&nbsp; <b>DDragon:</b> {{ ddVersion() || '...' }}
        </p>

        <!-- ✅ TEAM SUMMARY -->
        <div
          *ngIf="teams() as tmap"
          style="border:1px solid #eee; padding:12px; border-radius:12px; margin:12px 0;"
        >
          <h3 style="margin:0 0 8px 0;">Team Summary</h3>

          <div style="display:flex; gap:12px; flex-wrap:wrap;">
            <!-- BLUE -->
            <div
              style="flex:1; min-width:320px; border:1px solid #ddd; border-radius:12px; padding:10px;"
            >
              <div
                style="display:flex; justify-content:space-between; align-items:center; gap:10px;"
              >
                <b>Blue (100)</b>
                <span style="font-weight:700">{{ tmap[100]?.win ? 'WIN' : 'LOSS' }}</span>
              </div>

              <div style="margin-top:6px; opacity:.95;">
                <b>Kills:</b> {{ teamAgg()[100]?.kills ?? 0 }}
                &nbsp;|&nbsp;
                <b>Gold:</b> {{ teamAgg()[100]?.gold ?? 0 }}
                &nbsp;|&nbsp;
                <b>Dmg:</b> {{ teamAgg()[100]?.dmg ?? 0 }}
              </div>

              <div style="margin-top:6px; opacity:.95;">
                <b>Towers:</b> {{ tmap[100]?.objectives?.tower?.kills ?? 0 }}
                &nbsp;|&nbsp;
                <b>Dragons:</b> {{ tmap[100]?.objectives?.dragon?.kills ?? 0 }}
                &nbsp;|&nbsp;
                <b>Baron:</b> {{ tmap[100]?.objectives?.baron?.kills ?? 0 }}
                &nbsp;|&nbsp;
                <b>Herald:</b> {{ tmap[100]?.objectives?.riftHerald?.kills ?? 0 }}
              </div>
            </div>

            <!-- RED -->
            <div
              style="flex:1; min-width:320px; border:1px solid #ddd; border-radius:12px; padding:10px;"
            >
              <div
                style="display:flex; justify-content:space-between; align-items:center; gap:10px;"
              >
                <b>Red (200)</b>
                <span style="font-weight:700">{{ tmap[200]?.win ? 'WIN' : 'LOSS' }}</span>
              </div>

              <div style="margin-top:6px; opacity:.95;">
                <b>Kills:</b> {{ teamAgg()[200]?.kills ?? 0 }}
                &nbsp;|&nbsp;
                <b>Gold:</b> {{ teamAgg()[200]?.gold ?? 0 }}
                &nbsp;|&nbsp;
                <b>Dmg:</b> {{ teamAgg()[200]?.dmg ?? 0 }}
              </div>

              <div style="margin-top:6px; opacity:.95;">
                <b>Towers:</b> {{ tmap[200]?.objectives?.tower?.kills ?? 0 }}
                &nbsp;|&nbsp;
                <b>Dragons:</b> {{ tmap[200]?.objectives?.dragon?.kills ?? 0 }}
                &nbsp;|&nbsp;
                <b>Baron:</b> {{ tmap[200]?.objectives?.baron?.kills ?? 0 }}
                &nbsp;|&nbsp;
                <b>Herald:</b> {{ tmap[200]?.objectives?.riftHerald?.kills ?? 0 }}
              </div>
            </div>
          </div>
        </div>

        <!-- ✅ Player -->
        <div
          *ngIf="player() as p"
          style="border:1px solid #ddd; padding:10px; border-radius:10px; margin:10px 0;"
        >
          <h3>Player (căutat)</h3>

          <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap">
            <img
              *ngIf="champIconUrl(p.championId) as cicon"
              [src]="cicon"
              width="52"
              height="52"
              style="border-radius:12px; border:1px solid #ddd"
            />

            <div>
              <div style="font-weight:700">
                {{ champName(p.championId) || 'Champion #' + p.championId }}
                <span style="font-weight:400; opacity:.8"> — {{ p.win ? 'WIN' : 'LOSS' }}</span>
              </div>

              <div>
                <b>KDA:</b> {{ p.kills }}/{{ p.deaths }}/{{ p.assists }}
                &nbsp;|&nbsp;
                <b>CS:</b> {{ cs(p) }}
                &nbsp;|&nbsp;
                <b>Vision:</b> {{ p.visionScore ?? 0 }}
              </div>

              <div
                style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-top:6px;"
              >
                <img
                  *ngIf="spellIconUrl(p.summoner1Id) as s1"
                  [src]="s1"
                  width="26"
                  height="26"
                  style="border-radius:6px; border:1px solid #ddd"
                  [title]="spellTitle(p.summoner1Id) || 'Spell 1'"
                />

                <img
                  *ngIf="spellIconUrl(p.summoner2Id) as s2"
                  [src]="s2"
                  width="26"
                  height="26"
                  style="border-radius:6px; border:1px solid #ddd"
                  [title]="spellTitle(p.summoner2Id) || 'Spell 2'"
                />

                <ng-container *ngFor="let it of itemIds(p)">
                  <img
                    *ngIf="itemIconUrl(it) as iu"
                    [src]="iu"
                    width="26"
                    height="26"
                    style="border-radius:6px; border:1px solid #ddd"
                    [title]="itemTitle(it)"
                  />
                </ng-container>
              </div>
            </div>
          </div>
        </div>

        <!-- ✅ Timeline (Kills + Objectives) -->
        <div
          *ngIf="killFeed().length || objectiveFeed().length"
          style="border:1px solid #eee; padding:12px; border-radius:12px; margin:12px 0;"
        >
          <h3 style="margin:0 0 10px 0;">Timeline</h3>

          <div style="display:flex; gap:14px; flex-wrap:wrap;">
            <!-- KILL FEED -->
            <div style="flex:1; min-width:340px;">
              <h4 style="margin:0 0 8px 0;">Kill feed</h4>

              <div *ngIf="!killFeed().length" style="opacity:.8">No kill events.</div>

              <div
                *ngFor="let e of killFeed()"
                style="display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid #f1f1f1;"
              >
                <div style="width:44px; font-weight:700;">{{ e.minute }}'</div>

                <!-- killer -->
                <img
                  *ngIf="e.killer?.championId && champIconUrl(e.killer?.championId) as kc"
                  [src]="kc"
                  width="22"
                  height="22"
                  style="border-radius:6px; border:1px solid #ddd"
                  [title]="playerName(e.killer)"
                />
                <span style="font-weight:700">{{ playerName(e.killer) }}</span>

                <span style="opacity:.7">killed</span>

                <!-- victim -->
                <img
                  *ngIf="e.victim?.championId && champIconUrl(e.victim?.championId) as vc"
                  [src]="vc"
                  width="22"
                  height="22"
                  style="border-radius:6px; border:1px solid #ddd"
                  [title]="playerName(e.victim)"
                />
                <span style="font-weight:700">{{ playerName(e.victim) }}</span>

                <!-- assists -->
                <span *ngIf="e.assists?.length" style="opacity:.75">
                  (assists:
                  <ng-container *ngFor="let a of e.assists; let last = last">
                    {{ playerName(a) }}<span *ngIf="!last">, </span>
                  </ng-container>
                  )
                </span>
              </div>
            </div>

            <!-- OBJECTIVES -->
            <div style="flex:1; min-width:340px;">
              <h4 style="margin:0 0 8px 0;">Objectives</h4>

              <div *ngIf="!objectiveFeed().length" style="opacity:.8">No objective events.</div>

              <div
                *ngFor="let o of objectiveFeed()"
                style="display:flex; gap:10px; padding:6px 0; border-bottom:1px solid #f1f1f1;"
              >
                <div style="width:44px; font-weight:700;">{{ o.minute }}'</div>
                <div style="flex:1;">
                  <span style="font-weight:700">{{ o.text }}</span>
                  <span *ngIf="o.killer" style="opacity:.85">
                    — by {{ playerName(o.killer) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          *ngIf="goldSeries().length"
          style="border:1px solid #eee; padding:12px; border-radius:12px; margin:12px 0;"
        >
          <h3 style="margin:0 0 8px 0;">Gold diff by minute</h3>

          <div
            *ngFor="let g of goldSeries().slice(-12)"
            style="display:flex; gap:10px; border-bottom:1px solid #f1f1f1; padding:6px 0;"
          >
            <div style="width:44px; font-weight:700;">{{ g.minute }}'</div>
            <div style="flex:1; opacity:.9;">Blue {{ g.blueGold }} — Red {{ g.redGold }}</div>
            <div style="width:110px; text-align:right; font-weight:700;">
              {{ g.diff >= 0 ? '+' : '' }}{{ g.diff }}
            </div>
          </div>
        </div>

        <!-- ✅ Participants -->
        <h3>Participants</h3>

        <div
          *ngFor="let p of d.match?.info?.participants"
          style="border:1px solid #eee; padding:8px; margin:6px 0; border-radius:10px;"
          [style.background]="p.puuid === puuid() ? '#f6f6f6' : 'transparent'"
        >
          <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; gap:10px; align-items:flex-start;">
              <img
                *ngIf="champIconUrl(p.championId) as cicon"
                [src]="cicon"
                width="34"
                height="34"
                style="border-radius:10px; border:1px solid #ddd"
              />

              <div>
                <div style="font-weight:700">
                  {{ p.riotIdGameName || p.summonerName || 'Player' }}
                  <span style="font-weight:400; opacity:.8">
                    — {{ champName(p.championId) || '#' + p.championId }}
                  </span>
                </div>

                <div style="opacity:.95">
                  {{ p.win ? 'WIN' : 'LOSS' }}
                  | KDA {{ p.kills }}/{{ p.deaths }}/{{ p.assists }} | CS {{ cs(p) }} | Vision
                  {{ p.visionScore ?? 0 }}
                </div>

                <div
                  style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-top:6px;"
                >
                  <img
                    *ngIf="spellIconUrl(p.summoner1Id) as s1"
                    [src]="s1"
                    width="22"
                    height="22"
                    style="border-radius:6px; border:1px solid #ddd"
                    [title]="spellTitle(p.summoner1Id) || 'Spell 1'"
                  />
                  <img
                    *ngIf="spellIconUrl(p.summoner2Id) as s2"
                    [src]="s2"
                    width="22"
                    height="22"
                    style="border-radius:6px; border:1px solid #ddd"
                    [title]="spellTitle(p.summoner2Id) || 'Spell 2'"
                  />

                  <ng-container *ngFor="let it of itemIds(p)">
                    <img
                      *ngIf="itemIconUrl(it) as iu"
                      [src]="iu"
                      width="22"
                      height="22"
                      style="border-radius:6px; border:1px solid #ddd"
                      [title]="itemTitle(it)"
                    />
                  </ng-container>
                </div>
              </div>
            </div>

            <div style="opacity:.9; text-align:right">
              Gold: {{ p.goldEarned }} | Dmg: {{ p.totalDamageDealtToChampions }}
            </div>
          </div>
        </div>

        <details style="margin-top:12px">
          <summary>Debug JSON</summary>
          <pre>{{ d | json }}</pre>
        </details>
      </div>
    </div>
  `,
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
  puuuid = signal<string>(''); // păstrăm ce aveai (nu folosim)
  puuid = signal<string>(''); // folosim
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
      this.matchId.set(pm.get('matchId') ?? '');
      this.puuid.set(pm.get('puuid') ?? '');
      this.load();
    });
  }

  back() {
    this.location.back();
  }

  home() {
    this.router.navigate(['/']);
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
