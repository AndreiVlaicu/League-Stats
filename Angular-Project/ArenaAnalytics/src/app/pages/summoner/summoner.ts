import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of, throwError } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { Location } from '@angular/common';

import { RiotApiService } from '../../core/riot-api';
import { RegionUI, REGION_TO_PLATFORM, REGION_TO_ROUTING, QUEUE_NAMES } from '../../core/regions';

@Component({
  standalone: true,
  selector: 'app-summoner',
  imports: [CommonModule, FormsModule],
  template: `
    <div style="padding:16px">
      <!-- ✅ Search bar păstrată -->
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:12px;">
        <select [(ngModel)]="region">
          <option>EUW</option>
          <option>EUNE</option>
          <option>NA</option>
        </select>

        <input [(ngModel)]="gameName" placeholder="gameName" />
        <input [(ngModel)]="tagLine" placeholder="tagLine" />

        <button (click)="go()">Caută</button>
        <button (click)="back()">Înapoi</button>
        <button (click)="home()">Home</button>
      </div>

      <h2>Summoner</h2>

      <p *ngIf="loading()">Loading...</p>
      <p *ngIf="error()">{{ error() }}</p>

      <div *ngIf="bundle() as b">
        <h3>{{ b.account.gameName }}#{{ b.account.tagLine }}</h3>
        <p>Level: {{ b.summoner.summonerLevel }} | IconId: {{ b.summoner.profileIconId }}</p>

        <div *ngIf="b.rank?.length">
          <h3>Ranked</h3>
          <div *ngFor="let r of b.rank" style="border:1px solid #ddd; padding:8px; margin:6px 0">
            <b>{{ r.queueType }}</b> — {{ r.tier }} {{ r.rank }} ({{ r.leaguePoints }} LP)
            <div>W/L: {{ r.wins }}/{{ r.losses }}</div>
          </div>
        </div>

        <div *ngIf="b.matchIds?.length === 0">
          Nu există meciuri pentru acest cont (sau e cont nou).
        </div>

        <div *ngIf="b.matches?.length">
          <h3>Match history (primele {{ b.matches.length }})</h3>

          <div
            *ngFor="let m of b.matches"
            style="border:1px solid #ccc; padding:10px; margin:8px 0"
          >
            <div>
              <b>{{ queueName(m.info?.queueId) }}</b>
            </div>
            <div><b>Match:</b> {{ m.metadata?.matchId }}</div>
            <div>
              <b>Duration:</b> {{ (m.info?.gameDuration ?? 0) / 60 | number : '1.0-0' }} min
            </div>
          </div>
        </div>

        <details style="margin-top:12px">
          <summary>Debug JSON</summary>
          <pre>{{ b | json }}</pre>
        </details>
      </div>
    </div>
  `,
})
export class SummonerComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private riot = inject(RiotApiService);

  // ✅ inputuri pentru bara de search
  region: RegionUI = 'EUW';
  gameName = '';
  tagLine = '';

  loading = signal(false);
  error = signal<string | null>(null);
  bundle = signal<any>(null);
  private location = inject(Location);

  ngOnInit() {
    this.route.paramMap.subscribe((pm) => {
      const region = (pm.get('region') as RegionUI) ?? 'EUW';
      const gameName = pm.get('gameName') ?? '';
      const tagLine = pm.get('tagLine') ?? '';

      // ✅ păstrează completat în bară
      this.region = region;
      this.gameName = gameName;
      this.tagLine = tagLine;

      this.load(region, gameName, tagLine);
    });
  }

  go() {
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

  queueName(queueId?: number) {
    if (!queueId) return 'Unknown queue';
    return QUEUE_NAMES[queueId] ?? `Queue ${queueId}`;
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

    const platform = REGION_TO_PLATFORM[region];
    const routing = REGION_TO_ROUTING[region];

    this.riot
      .accountByRiotId(routing, gameName, tagLine)
      .pipe(
        // 1) ia account + caută summoner pe platform corect (cu fallback EUW↔EUNE)
        switchMap((account) =>
          this.summonerByPuuidWithFallback(region, account.puuid).pipe(
            map(({ summoner, platform }) => ({ account, summoner, platform }))
          )
        ),

        // 2) rank + matchIds
        switchMap(({ account, summoner, platform }) =>
          forkJoin({
            // ✅ guard: dacă summoner.id lipsește, nu mai chemăm rank endpoint
            rank: summoner?.id ? this.riot.getRankBySummonerId(platform, summoner.id) : of([]),
            matchIds: this.riot.matchIdsByPuuid(routing, account.puuid, 0, 20),
          }).pipe(map((extra) => ({ account, summoner, platform, ...extra })))
        ),

        // 3) match details pentru primele 5
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
          this.error.set(
            `HTTP ${err?.status ?? ''} ${err?.statusText ?? ''} | ${err?.message ?? ''}`
          );
          this.loading.set(false);
        },
      });
  }
}
