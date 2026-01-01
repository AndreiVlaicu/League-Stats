import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FavoritesService } from '../../core/services/favorites';

@Component({
  standalone: true,
  selector: 'app-favorites',
  imports: [CommonModule],
  templateUrl: './favorites.html',
  styleUrls: ['./favorites.css'],
})
export class FavoritesComponent {
  favs = inject(FavoritesService);
  router = inject(Router);

  open(f: any) {
    this.router.navigate(['/summoner', f.region, f.gameName, f.tagLine]);
  }

  remove(f: any) {
    this.favs.remove(f.region, f.gameName, f.tagLine);
  }

  clear() {
    this.favs.clear();
  }

  home() {
    this.router.navigate(['/']);
  }
}
