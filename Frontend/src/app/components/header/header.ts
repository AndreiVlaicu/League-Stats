import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FavoritesService, FavoritePlayer } from '../../core/services/favorites';
import { RegionUI } from '../../core/regions';

@Component({
  standalone: true,
  selector: 'app-header',
  imports: [CommonModule, FormsModule],
  templateUrl: './header.html',
  styleUrls: ['./header.css'],
})
export class HeaderComponent {
  private router = inject(Router);
  favs = inject(FavoritesService);

  region: RegionUI = 'EUW';
  gameName = 'Caps';
  tagLine = 'G2';
  playerInput = '';

  presets: Array<{ region: RegionUI; gameName: string; tagLine: string; label: string }> = [
    { region: 'EUW', gameName: 'Caps', tagLine: 'G2', label: 'Caps#G2 (EUW)' },
    { region: 'EUNE', gameName: 'alfa', tagLine: 'UE4', label: 'alfa#UE4 (EUNE)' },
    { region: 'EUNE', gameName: 'Gimishoor', tagLine: '1337', label: 'Gimishoor#1337 (EUNE)' },
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

  private normalizeInputs() {
    if ((!this.gameName || !this.tagLine) && (this.playerInput || '').includes('#')) {
      this.applyPlayerInput(this.playerInput);
    }
    if (this.gameName.includes('#') && !this.tagLine) {
      const [g, t] = this.gameName.split('#');
      this.gameName = (g || '').trim();
      this.tagLine = (t || '').trim();
    }
  }

  openSummoner() {
    this.normalizeInputs();
    if (!this.gameName.trim() || !this.tagLine.trim()) {
      alert('Please enter both Game Name and Tag Line');
      return;
    }
    this.router.navigate(['/summoner', this.region, this.gameName, this.tagLine]);
  }

  goHome() {
    this.router.navigate(['/']);
  }

  goFavorites() {
    this.router.navigate(['/favorites']);
  }
}
