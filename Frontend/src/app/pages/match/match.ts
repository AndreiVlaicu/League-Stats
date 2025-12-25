import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { RiotApiService } from '../../core/riot-api';
import {
  ChampionService,
  ChampionData,
  SummonerSpellData,
  ItemData,
} from '../../core/services/champion.service';
import { RegionUI, REGION_TO_ROUTING, QUEUE_NAMES } from '../../core/regions';

@Component({
  standalone: true,
  selector: 'app-match',
  imports: [CommonModule, FormsModule],
  template: `
    <div style="padding:16px">
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:12px;">
        <button (click)="back()">Înapoi</button>
        <button (click)="home()">Home</button>
      </div>

      <h2>Match details</h2>

      @if (loading()) {
      <p>Loading...</p>
      } @if (error()) {
      <p>{{ error() }}</p>
      } @if (match(); as m) {
      <p>
        <b>Match:</b> {{ m.metadata?.matchId }}
        &nbsp;|&nbsp;
        <b>Queue:</b> {{ queueName(m.info?.queueId) }}
        &nbsp;|&nbsp;
        <b>Duration:</b> {{ (m.info?.gameDuration ?? 0) / 60 | number : '1.0-0' }} min &nbsp;|&nbsp;
        <b>DDragon:</b> {{ ddVersion() || '...' }}
      </p>

      <div style="margin-top:12px">
        <h3>Participants</h3>

        @for (p of (m.info?.participants ?? []); track p?.puuid) {
        <div
          style="border:1px solid #ddd; padding:10px; margin:8px 0; border-radius:10px;"
          [style.outline]="p?.puuid === highlightPuuid() ? '2px solid #000' : 'none'"
        >
          <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap">
            @if (champIconUrl(p?.championId); as cicon) {
            <img
              [src]="cicon"
              width="52"
              height="52"
              style="border-radius:12px; border:1px solid #ddd"
            />
            }

            <div style="flex:1; min-width:260px">
              <div style="font-weight:700">
                {{ champName(p?.championId) || 'Champion #' + p?.championId }}
                <span style="font-weight:400; opacity:.8">
                  — {{ p?.summonerName || 'Unknown' }} — {{ p?.win ? 'WIN' : 'LOSS' }}
                </span>
              </div>

              <div><b>KDA:</b> {{ p?.kills }}/{{ p?.deaths }}/{{ p?.assists }}</div>

              <div
                style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-top:6px;"
              >
                <!-- spells -->
                @if (spellIconUrl(p?.summoner1Id); as s1) {
                <img
                  [src]="s1"
                  width="26"
                  height="26"
                  style="border-radius:6px; border:1px solid #ddd"
                />
                } @if (spellIconUrl(p?.summoner2Id); as s2) {
                <img
                  [src]="s2"
                  width="26"
                  height="26"
                  style="border-radius:6px; border:1px solid #ddd"
                />
                }

                <!-- items -->
                @for (it of itemIds(p); track it) { @if (itemIconUrl(it); as iu) {
                <img
                  [src]="iu"
                  width="26"
                  height="26"
                  style="border-radius:6px; border:1px solid #ddd"
                  [title]="itemName(it) || 'Item ' + it"
                />
                } }
              </div>
            </div>
          </div>
        </div>
        }
      </div>

      <details style="margin-top:12px">
        <summary>Debug JSON</summary>
        <pre>{{ m | json }}</pre>
      </details>
      }
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
  match = signal<any>(null);

  highlightPuuid = signal<string>('');

  ddVersion = signal<string>('');
  championsByKey = signal<Record<string, ChampionData>>({});
  spellsByKey = signal<Record<string, SummonerSpellData>>({});
  itemsById = signal<Record<string, ItemData>>({});

  ngOnInit() {
    // preload DataDragon
    this.champs.getVersion().subscribe({
      next: (v) => this.ddVersion.set(v),
      error: () => this.ddVersion.set(this.champs.getVersionSync()),
    });
    this.champs.getChampionsByKey().subscribe({ next: (m) => this.championsByKey.set(m) });
    this.champs.getSummonerSpellsByKey().subscribe({ next: (m) => this.spellsByKey.set(m) });
    this.champs.getItemsById().subscribe({ next: (m) => this.itemsById.set(m) });

    // read route
    this.route.paramMap
      .pipe(
        switchMap((pm) => {
          const region = (pm.get('region') as RegionUI) ?? 'EUW';
          const matchId = pm.get('matchId') ?? '';

          const routing = REGION_TO_ROUTING[region];

          // query param pentru highlight
          const qp = this.route.snapshot.queryParamMap.get('puuid') ?? '';
          this.highlightPuuid.set(qp);

          this.loading.set(true);
          this.error.set(null);
          this.match.set(null);

          return this.riot.matchById(routing, matchId);
        })
      )
      .subscribe({
        next: (m) => {
          this.match.set(m);
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

  champName(championId?: number) {
    return this.champs.championNameByNumericKeySync(championId ?? 0, this.championsByKey());
  }

  champIconUrl(championId?: number) {
    const url = this.champs.championSquareUrlByNumericKeySync(
      championId ?? 0,
      this.championsByKey(),
      this.ddVersion()
    );
    return url || null;
  }

  spellIconUrl(spellKey?: number) {
    const url = this.champs.spellIconUrlByNumericKeySync(
      spellKey ?? 0,
      this.spellsByKey(),
      this.ddVersion()
    );
    return url || null;
  }

  itemIconUrl(itemId?: number) {
    const url = this.champs.getItemImageUrl(itemId ?? 0, this.ddVersion());
    return url || null;
  }

  itemName(itemId?: number) {
    return this.itemsById()[String(itemId ?? 0)]?.name ?? '';
  }

  itemIds(p: any): number[] {
    return [p?.item0, p?.item1, p?.item2, p?.item3, p?.item4, p?.item5, p?.item6]
      .map((x: any) => Number(x ?? 0))
      .filter((x) => !!x && x > 0);
  }
}
