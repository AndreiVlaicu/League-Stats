import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RiotApiService } from '../../core/riot-api';
import { forkJoin, of, switchMap } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { RegionUI, REGION_TO_PLATFORM, REGION_TO_ROUTING } from '../../core/regions';

@Component({
  standalone: true,
  selector: 'app-home',
  imports: [CommonModule, FormsModule],
  template: `
    <div style="padding:16px">
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap">
        <select [(ngModel)]="region">
          <option>EUW</option>
          <option>EUNE</option>
          <option>NA</option>
        </select>
    
        <input [(ngModel)]="gameName" placeholder="gameName (ex: Caps)" />
        <input [(ngModel)]="tagLine" placeholder="tagLine (ex: G2)" />
    
        <button (click)="search()">Caută</button>
        <button (click)="openSummoner()">Deschide Summoner</button>
      </div>
    
      @if (loading()) {
        <p>Loading...</p>
      }
      @if (error()) {
        <p>{{ error() }}</p>
      }
    
      @if (data(); as d) {
        <pre>{{ d | json }}</pre>
      }
    
      @if (data() && data().matchIds?.length === 0) {
        <p>
          Nu există meciuri pentru acest cont (sau e un cont nou). Încearcă alt Riot ID.
        </p>
      }
    
      @if (data()?.matches?.length) {
        <div>
          <h3>Match history (primele 5)</h3>
          @for (m of data().matches; track m) {
            <div
              style="border:1px solid #ccc; padding:8px; margin:6px 0"
              >
              <div><b>Match:</b> {{ m.metadata?.matchId }}</div>
              <div><b>Duration:</b> {{ (m.info?.gameDuration ?? 0) / 60 | number : '1.0-0' }} min</div>
              <div><b>Queue:</b> {{ m.info?.queueId }}</div>
            </div>
          }
        </div>
      }
    </div>
    `,
})
export class HomeComponent {
  private riot = inject(RiotApiService);
  private router = inject(Router);

  region: RegionUI = 'EUW';
  gameName = 'Caps';
  tagLine = 'G2';

  data = signal<any>(null);
  error = signal<string | null>(null);
  loading = signal(false);

  openSummoner() {
    const g = this.gameName.trim();
    const t = this.tagLine.trim();
    if (!g || !t) return;

    this.router.navigate(['/summoner', this.region, g, t]);
  }

  search() {
    this.loading.set(true);
    this.error.set(null);
    this.data.set(null);

    const platform = REGION_TO_PLATFORM[this.region];
    const routing = REGION_TO_ROUTING[this.region];

    this.riot
      .accountByRiotId(routing, this.gameName, this.tagLine)
      .pipe(
        switchMap((account) =>
          forkJoin({
            account: of(account),
            summoner: this.riot.summonerByPuuid(platform, account.puuid),
            matchIds: this.riot.matchIdsByPuuid(routing, account.puuid, 0, 20),
          }).pipe(
            switchMap((base) => {
              const first5 = (base.matchIds ?? []).slice(0, 5);
              if (first5.length === 0) return of({ ...base, matches: [] });

              return forkJoin(first5.map((id) => this.riot.matchById(routing, id))).pipe(
                switchMap((matches) => of({ ...base, matches }))
              );
            })
          )
        )
      )
      .subscribe({
        next: (res) => {
          this.data.set(res);
          this.loading.set(false);
        },
        error: (err) => {
          const body =
            typeof err?.error === 'string'
              ? err.error.slice(0, 120)
              : JSON.stringify(err?.error ?? {}).slice(0, 120);

          this.error.set(`HTTP ${err?.status} | ${err?.message} | body: ${body}`);
          this.loading.set(false);
        },
      });
  }
}
