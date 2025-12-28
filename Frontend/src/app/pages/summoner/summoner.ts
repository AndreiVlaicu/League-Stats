import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of, throwError } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { Location } from '@angular/common';

import { RiotApiService } from '../../core/riot-api';
import {
  ChampionService,
  ChampionData,
  SummonerSpellData,
  ItemData,
} from '../../core/services/champion.service'; 
import { RegionUI, REGION_TO_PLATFORM, REGION_TO_ROUTING, QUEUE_NAMES } from '../../core/regions';

@Component({
  standalone: true,
  selector: 'app-summoner',
  imports: [CommonModule, FormsModule],
  templateUrl: './summoner.html',
  styleUrls: ['./summoner.css'],
})
export class SummonerComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private riot = inject(RiotApiService);
  private location = inject(Location);

  private champs = inject(ChampionService);
  private ddragon = inject(ChampionService);

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

  presets: Array<{ region: RegionUI; gameName: string; tagLine: string; label: string }> = [
    { region: 'EUW', gameName: 'Caps', tagLine: 'G2', label: 'Caps#G2 (EUW)' },
    { region: 'EUNE', gameName: 'alfa', tagLine: 'UE4', label: 'alfa#UE4 (EUNE)' },
  ];

  uniqueGameNames(): string[] {
    return Array.from(new Set(this.presets.map((p) => p.gameName))).sort();
  }
  uniqueTagLines(): string[] {
    return Array.from(new Set(this.presets.map((p) => p.tagLine))).sort();
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
            rank: summoner?.id ? this.riot.getRankBySummonerId(platform, summoner.id) : of([]),

            currentGame: summoner?.id
              ? this.riot.getCurrentGame(platform, summoner.id).pipe(
                  catchError((err) => {
                    if (err?.status === 404) return of(null);
                    return throwError(() => err);
                  })
                )
              : of(null),

            masteries: summoner?.id
              ? this.riot.getChampionMasteries(platform, summoner.id).pipe(catchError(() => of([])))
              : of([]),

            matchIds: this.riot.matchIdsByPuuid(routing, account.puuid, 0, 20),
          }).pipe(map((extra) => ({ account, summoner, platform, ...extra })))
        ),

        switchMap((base2) => {
          const ids = (base2.matchIds ?? []).slice(0, 5);
          if (ids.length === 0) return of({ ...base2, matches: [] });

          return forkJoin(ids.map((id: string) => this.riot.matchById(routing, id))).pipe(
            map((matches) => ({ ...base2, matches }))
          );
        })
      )
      .subscribe({
        next: (res) => {
          this.bundle.set(res);
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
