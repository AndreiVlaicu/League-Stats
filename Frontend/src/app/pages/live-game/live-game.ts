import { Component, inject, signal, Input, SimpleChanges, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { catchError } from 'rxjs/operators';
import { of, throwError } from 'rxjs';

import { RiotApiService } from '../../core/riot-api';
import {
  ChampionService,
  ChampionData,
  SummonerSpellData,
} from '../../core/services/champion.service';
import { QUEUE_NAMES, RegionUI } from '../../core/regions';

type TeamId = 100 | 200;

@Component({
  standalone: true,
  selector: 'app-live-game',
  imports: [CommonModule],
  templateUrl: './live-game.html',
  styleUrls: ['./live-game.css'],
})
export class LiveGameComponent implements OnChanges {
  @Input() embedded = false;
  @Input() gameData: any = null;
  @Input() platformInput: string | null = null;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);

  private riot = inject(RiotApiService);
  private champs = inject(ChampionService);

  loading = signal(false);
  error = signal<string | null>(null);

  platform = signal<string>('euw1');
  summonerId = signal<string>('');

  game = signal<any>(null);

  ddVersion = signal<string>('');
  championsByKey = signal<Record<string, ChampionData>>({});
  spellsByKey = signal<Record<string, SummonerSpellData>>({});

  ngOnInit() {
    // DataDragon preload
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

    if (this.embedded) {
      if (this.platformInput) {
        this.platform.set(this.platformInput);
      }
      if (this.gameData) {
        this.game.set(this.gameData);
      }
    } else {
      // params
      this.route.paramMap.subscribe((pm) => {
        const p = pm.get('platform');
        const s = pm.get('summonerId');
        if (p) this.platform.set(p);
        if (s) this.summonerId.set(s);

        if (p && s) {
          this.load();
        }
      });
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['platformInput'] && this.platformInput) {
      this.platform.set(this.platformInput);
    }
    if (changes['gameData'] && this.gameData) {
      this.game.set(this.gameData);
    }
  }

  back() {
    this.location.back();
  }
  home() {
    this.router.navigate(['/']);
  }
  openProfile(p: any) {
    const puuid = p?.puuid;
    if (puuid) {
      this.openByPuuid(puuid);
      return;
    }

    const sid = p?.summonerId;
    if (!sid) return;

    const platform = this.platform();

    this.riot.summonerBySummonerId(platform, sid).subscribe({
      next: (s) => {
        if (s?.puuid) this.openByPuuid(s.puuid);
      },
      error: () => {
        this.error.set('Unable to open the profile (missing PUUID and the lookup failed).');
      },
    });
  }

  private regionFromPlatform(platform: string): RegionUI {
    const p = (platform || '').toLowerCase();
    if (p.startsWith('euw')) return 'EUW';
    if (p.startsWith('eun')) return 'EUNE';
    if (p.startsWith('na')) return 'NA';
    return 'EUW';
  }

  openByPuuid(puuid: string) {
    if (!puuid) return;
    const region = this.regionFromPlatform(this.platform());
    this.router.navigate(['/summoner-puuid', region, puuid]);
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
    return (
      this.champs.championSquareUrlByNumericKeySync(
        championId ?? 0,
        this.championsByKey(),
        this.ddVer()
      ) || null
    );
  }

  spellIconUrl(spellKey?: number) {
    return (
      this.champs.spellIconUrlByNumericKeySync(spellKey ?? 0, this.spellsByKey(), this.ddVer()) ||
      null
    );
  }

  spellTitle(spellKey?: number) {
    return this.champs.spellNameByNumericKeySync(spellKey ?? 0, this.spellsByKey());
  }

  isArenaMode() {
    const g = this.game();
    return g?.participants?.length === 16 || g?.gameMode === 'CHERRY';
  }

  allParticipants() {
    return this.game()?.participants ?? [];
  }

  team(teamId: TeamId) {
    const participants = this.game()?.participants ?? [];
    return participants.filter((p: any) => Number(p?.teamId) === Number(teamId));
  }

  private load() {
    const platform = this.platform();
    const summonerId = this.summonerId();
    if (!platform || !summonerId) return;

    this.loading.set(true);
    this.error.set(null);
    this.game.set(null);

    this.riot
      .getCurrentGame(platform, summonerId)
      .pipe(
        catchError((err) => {
          // 404 = not in game (normal)
          if (err?.status === 404) return of(null);
          return throwError(() => err);
        })
      )
      .subscribe({
        next: (g) => {
          this.game.set(g);
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
