import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of, throwError } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { Location } from '@angular/common';
import { FavoritesService } from '../../core/services/favorites';

import { RiotApiService } from '../../core/riot-api';
import {
  ChampionService,
  ChampionData,
  SummonerSpellData,
  ItemData,
} from '../../core/services/champion.service';
import { RegionUI, REGION_TO_PLATFORM, REGION_TO_ROUTING, QUEUE_NAMES } from '../../core/regions';
import { LiveGameComponent } from '../live-game/live-game';

@Component({
  standalone: true,
  selector: 'app-summoner',
  imports: [CommonModule, FormsModule, LiveGameComponent],
  templateUrl: './summoner.html',
  styleUrls: ['./summoner.css'],
})
export class SummonerComponent {
  matchType = signal<'ALL' | 'RANKED' | 'NORMAL' | 'ARAM' | 'URF' | 'OTHER'>('ALL');

  getMatchType(queueId?: number): 'RANKED' | 'NORMAL' | 'ARAM' | 'URF' | 'OTHER' {
    if (!queueId) return 'OTHER';
    if (queueId === 420 || queueId === 440) return 'RANKED';
    if (queueId === 400 || queueId === 430) return 'NORMAL';
    if (queueId === 450) return 'ARAM';
    if (queueId === 900) return 'URF';
    return 'OTHER';
  }

  get filteredMatches() {
    const type = this.matchType();
    const allMatches = this.matches();

    const sorted = [...allMatches].sort((a, b) => {
      const timeA = a?.info?.gameEndTimestamp || a?.info?.gameStartTimestamp || 0;
      const timeB = b?.info?.gameEndTimestamp || b?.info?.gameStartTimestamp || 0;
      return timeB - timeA;
    });

    if (type === 'ALL') return sorted;
    return sorted.filter((m) => this.getMatchType(m?.info?.queueId) === type);
  }

  get championSummary() {
    const b = this.bundle();
    if (!b?.account?.puuid) return [];
    const puuid = b.account.puuid;
    const matches = this.matches();

    const stats: Record<
      string,
      {
        championName: string;
        championId: number;
        count: number;
        wins: number;
        kills: number;
        deaths: number;
        assists: number;
      }
    > = {};

    for (const m of matches) {
      if (!m?.info?.participants) continue;
      const p = m.info.participants.find((x: any) => x.puuid === puuid);
      if (!p) continue;

      const cid = p.championId;
      if (!stats[cid]) {
        stats[cid] = {
          championName: p.championName,
          championId: cid,
          count: 0,
          wins: 0,
          kills: 0,
          deaths: 0,
          assists: 0,
        };
      }
      stats[cid].count++;
      if (p.win) stats[cid].wins++;
      stats[cid].kills += p.kills;
      stats[cid].deaths += p.deaths;
      stats[cid].assists += p.assists;
    }

    return Object.values(stats)
      .filter((s) => s.count > 1)
      .sort((a, b) => b.count - a.count);
  }

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private riot = inject(RiotApiService);
  private location = inject(Location);

  private favs = inject(FavoritesService);

  private champs = inject(ChampionService);
  private ddragon = inject(ChampionService);
  private routeRegion(): RegionUI {
    return (this.route.snapshot.paramMap.get('region') as RegionUI) ?? this.region;
  }
  region: RegionUI = 'EUW';
  gameName = '';
  tagLine = '';

  loading = signal(false);
  error = signal<string | null>(null);
  bundle = signal<any>(null);

  ddVersion = signal<string>('');
  championsByKey = signal<Record<string, ChampionData>>({});
  spellsByKey = signal<Record<string, SummonerSpellData>>({});
  itemsById = signal<Record<string, ItemData>>({});
  playerInput = '';
  topMasteries = signal<any[]>([]);
  activeTab = signal<'overview' | 'mastery'>('overview');

  presets: Array<{ region: RegionUI; gameName: string; tagLine: string; label: string }> = [
    { region: 'EUW', gameName: 'Caps', tagLine: 'G2', label: 'Caps#G2 (EUW)' },
    { region: 'EUNE', gameName: 'alfa', tagLine: 'UE4', label: 'alfa#UE4 (EUNE)' },
  ];

  pageSize = 10;
  currentStart = 0;
  matches = signal<any[]>([]);
  isLoadingMore = signal(false);
  hasMoreMatches = signal(true);

  isFav = computed(() => {
    const b = this.bundle();
    const acc = b?.account;
    if (!acc) return false;

    const r = this.routeRegion();
    return this.favs.isFavorite(r, acc.gameName, acc.tagLine);
  });

  toggleFavorite() {
    const b = this.bundle();
    const acc = b?.account;
    if (!acc) return;

    const r = this.routeRegion();

    const label = `${acc.gameName}#${acc.tagLine}`;

    this.favs.toggle(r, acc.gameName, acc.tagLine, label);

    this.bundle.update((x) => (x ? { ...x } : x));
  }

  uniqueGameNames(): string[] {
    return Array.from(new Set(this.presets.map((p) => p.gameName))).sort();
  }
  uniqueTagLines(): string[] {
    return Array.from(new Set(this.presets.map((p) => p.tagLine))).sort();
  }

  loadMoreMatches() {
    if (this.isLoadingMore() || !this.hasMoreMatches()) return;

    const b = this.bundle();
    if (!b?.account?.puuid) return;

    this.isLoadingMore.set(true);

    const routing = REGION_TO_ROUTING[this.region];
    const puuid = b.account.puuid;

    this.riot.matchIdsByPuuid(routing, puuid, this.currentStart, this.pageSize).subscribe((ids) => {
      if (!ids.length) {
        this.hasMoreMatches.set(false);
        this.isLoadingMore.set(false);
        return;
      }

      this.currentStart += ids.length;

      let loaded = 0;
      ids.forEach((id) => {
        this.riot.matchById(routing, id).subscribe({
          next: (match) => {
            this.matches.update((arr) => [...arr, match]);
          },
          complete: () => {
            loaded++;
            if (loaded === ids.length) {
              if (ids.length < this.pageSize) {
                this.hasMoreMatches.set(false);
              }
              this.isLoadingMore.set(false);
            }
          },
        });
      });
    });
  }

  applyPlayerInput(value?: string) {
    const raw = (value ?? this.playerInput ?? '').trim();
    if (!raw) return;

    const preset = this.presets.find((p) => {
      const k1 = `${p.gameName}#${p.tagLine}`.toLowerCase();
      const k2 = (p.label || '').toLowerCase();
      const r = raw.toLowerCase();
      return r === k1 || r === k2;
    });

    if (preset) {
      this.region = preset.region;
      this.gameName = preset.gameName;
      this.tagLine = preset.tagLine;
      return;
    }

    if (raw.includes('#')) {
      const [g, t] = raw.split('#');
      const gg = (g ?? '').trim();
      const tt = (t ?? '').trim();
      if (gg) this.gameName = gg;
      if (tt) this.tagLine = tt;
    } else {
      this.gameName = raw;
    }
  }

  ngOnInit() {
    this.ddragon.getVersion().subscribe({
      next: (v) => this.ddVersion.set(v),
      error: () => this.ddVersion.set(this.ddragon.getVersionSync()),
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
      const region = (pm.get('region') as RegionUI) ?? 'EUW';
      const gameName = pm.get('gameName') ?? '';
      const tagLine = pm.get('tagLine') ?? '';

      this.region = region;
      this.gameName = gameName;
      this.tagLine = tagLine;

      this.load(region, gameName, tagLine);
    });
  }

  go() {
    if ((!this.gameName || !this.tagLine) && (this.playerInput || '').includes('#')) {
      this.applyPlayerInput(this.playerInput);
    }

    if (this.gameName.includes('#') && !this.tagLine) {
      const [g, t] = this.gameName.split('#');
      this.gameName = (g ?? '').trim();
      this.tagLine = (t ?? '').trim();
    }

    const g = this.gameName.trim();
    const t = this.tagLine.trim();
    if (!g || !t) return;

    this.router.navigate(['/summoner', this.region, g, t]);
  }

  back() {
    this.location.back();
  }

  home() {
    this.router.navigate(['/']);
  }

  openLive(platform: string, summonerId: string) {
    if (!platform || !summonerId) return;
    this.router.navigate(['/live', platform, summonerId]);
  }

  checkLiveGame() {
    const b = this.bundle();
    if (!b?.summoner?.puuid || !b?.platform) return;

    this.error.set(null);

    this.riot
      .getCurrentGameByPuuid(b.platform, b.summoner.puuid)
      .pipe(
        catchError((err) => {
          if (err?.status === 404) {
            return of(null);
          }
          return throwError(() => err);
        })
      )
      .subscribe({
        next: (currentGame) => {
          if (currentGame) {
            this.bundle.set({ ...b, currentGame });
          } else {
            this.error.set('The user is not in a game.');
          }
        },
        error: (err) => {
          this.error.set('Error checking live game.');
        },
      });
  }

  openMatch(arg1: any, arg2?: any) {
    const routing = REGION_TO_ROUTING[this.region];

    if (typeof arg1 === 'string') {
      const matchId = arg1;
      const puuid = arg2;
      if (!matchId || !puuid) return;
      this.router.navigate(['/match', routing, matchId, puuid]);
      return;
    }

    const b = arg1;
    const m = arg2;
    const matchId = m?.metadata?.matchId;
    const puuid = b?.account?.puuid;
    if (!matchId || !puuid) return;

    this.router.navigate(['/match', routing, matchId, puuid]);
  }

  queueName(queueId?: number) {
    if (!queueId) return 'Unknown queue';
    return QUEUE_NAMES[queueId] ?? `Queue ${queueId}`;
  }

  platformToRegion(platform?: string): string {
    if (!platform) return '';
    const p = platform.toLowerCase();
    const map: Record<string, string> = {
      euw1: 'EUW',
      eun1: 'EUNE',
      na1: 'NA',
      kr: 'KR',
      br1: 'BR',
      jp1: 'JP',
      oc1: 'OCE',
      tr1: 'TR',
      ru: 'RU',
      la1: 'LAN',
      la2: 'LAS',
    };
    return map[p] ?? platform.toUpperCase();
  }

  playerInMatch(match: any, puuid: string) {
    return match?.info?.participants?.find((p: any) => p?.puuid === puuid) ?? null;
  }

  private ddVer(): string {
    return this.ddVersion() || this.ddragon.getVersionSync() || '14.1.1';
  }

  profileIconUrl(iconId?: number): string | null {
    if (!iconId) return null;
    const ver = this.ddVer();
    return `https://ddragon.leagueoflegends.com/cdn/${ver}/img/profileicon/${iconId}.png`;
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

  masteryChampName(championId?: number) {
    return this.champs.championNameByNumericKeySync(championId ?? 0, this.championsByKey());
  }

  masteryChampIconUrl(championId?: number) {
    const url = this.champs.championSquareUrlByNumericKeySync(
      championId ?? 0,
      this.championsByKey(),
      this.ddVer()
    );
    return url || null;
  }

  private summonerByPuuidWithFallback(region: RegionUI, puuid: string) {
    const first = REGION_TO_PLATFORM[region];
    const fallback = region === 'EUW' ? 'eun1' : region === 'EUNE' ? 'euw1' : null;

    return this.riot.summonerByPuuid(first, puuid).pipe(
      map((summoner) => ({ summoner, platform: first })),
      catchError((err) => {
        const status = err?.status ?? err?.error?.status?.status_code ?? err?.error?.status_code;

        if (status === 404 && fallback) {
          return this.riot
            .summonerByPuuid(fallback, puuid)
            .pipe(map((summoner) => ({ summoner, platform: fallback })));
        }
        return throwError(() => err);
      })
    );
  }

  private load(region: RegionUI, gameName: string, tagLine: string) {
    this.loading.set(true);
    this.error.set(null);
    this.bundle.set(null);

    const routing = REGION_TO_ROUTING[region];

    this.riot
      .accountByRiotId(routing, gameName, tagLine)
      .pipe(
        switchMap((account) =>
          this.summonerByPuuidWithFallback(region, account.puuid).pipe(
            map(({ summoner, platform }) => ({ account, summoner, platform }))
          )
        ),

        switchMap(({ account, summoner, platform }) =>
          forkJoin({
            rank: summoner?.id
              ? this.riot.getRankBySummonerId(platform, summoner.id).pipe(catchError(() => of([])))
              : of([]),

            masteries: account?.puuid
              ? this.riot
                  .getChampionMasteriesByPuuid(platform, account.puuid)
                  .pipe(catchError(() => of([])))
              : of([]),

            topMasteries: account?.puuid
              ? this.riot
                  .getTopChampionMasteries(platform, account.puuid, 3)
                  .pipe(catchError(() => of([])))
              : of([]),

            matchIds: this.riot.matchIdsByPuuid(routing, account.puuid, 0, 20),
          }).pipe(map((extra) => ({ account, summoner, platform, ...extra, currentGame: null })))
        )
      )
      .subscribe({
        next: (res) => {
          this.bundle.set(res);
          this.topMasteries.set(res.topMasteries || []);

          this.matches.set([]);
          this.currentStart = 0;
          this.hasMoreMatches.set(true);

          this.loadMoreMatches();

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
