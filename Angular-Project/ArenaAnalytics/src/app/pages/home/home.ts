import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RiotApiService } from '../../core/riot-api';
import { forkJoin, of, switchMap } from 'rxjs';
import { FormsModule } from '@angular/forms';

type RegionUI = 'EUW' | 'EUNE' | 'NA';
const REGION_TO_PLATFORM: Record<RegionUI, string> = { EUW: 'euw1', EUNE: 'eun1', NA: 'na1' };
const REGION_TO_ROUTING: Record<RegionUI, string> = {
  EUW: 'europe',
  EUNE: 'europe',
  NA: 'americas',
};

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
      </div>

      <p *ngIf="loading()">Loading...</p>
      <p *ngIf="error()">{{ error() }}</p>

      <pre *ngIf="data() as d">{{ d | json }}</pre>

      <p *ngIf="data() && data().matchIds?.length === 0">
        Nu există meciuri pentru acest cont (sau e un cont nou). Încearcă alt Riot ID.
      </p>
    </div>
  `,
})
export class HomeComponent {
  private riot = inject(RiotApiService);

  // input-uri
  region: RegionUI = 'EUW';
  gameName = 'Caps';
  tagLine = 'G2';

  data = signal<any>(null);
  error = signal<string | null>(null);
  loading = signal(false);

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
            matchIds: this.riot.matchIdsByPuuid(routing, account.puuid, 20),
          })
        )
      )
      .subscribe({
        next: (account) => {
          this.data.set(account);
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
