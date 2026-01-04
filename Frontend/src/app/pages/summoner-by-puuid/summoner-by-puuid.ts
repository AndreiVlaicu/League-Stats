import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { RiotApiService } from '../../core/riot-api';
import { RegionUI, REGION_TO_ROUTING } from '../../core/regions';

@Component({
  standalone: true,
  selector: 'app-summoner-by-puuid',
  imports: [CommonModule],
  template: `
    <div style="padding:16px">
      @if (error()) {
      <p style="color:#b00">{{ error() }}</p>
      }
    </div>
  `,
})
export class SummonerByPuuidComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private riot = inject(RiotApiService);

  error = signal<string | null>(null);

  ngOnInit() {
    this.route.paramMap.subscribe((pm) => {
      const region = (pm.get('region') as RegionUI) ?? 'EUW';
      const puuid = pm.get('puuid') ?? '';
      if (!puuid) return;

      const routing = REGION_TO_ROUTING[region];

      this.riot.accountByPuuid(routing, puuid).subscribe({
        next: (acc) => {
          this.router.navigate(['/summoner', region, acc.gameName, acc.tagLine]);
        },
        error: (err) => {
          const body =
            typeof err?.error === 'string'
              ? err.error.slice(0, 160)
              : JSON.stringify(err?.error ?? {}).slice(0, 160);
          this.error.set(`HTTP ${err?.status ?? ''} | ${err?.message ?? ''} | ${body}`);
        },
      });
    });
  }
}
