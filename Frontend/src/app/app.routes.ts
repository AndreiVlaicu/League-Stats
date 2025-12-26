import { Routes } from '@angular/router';
import { MatchComponent } from './pages/match/match';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home').then((m) => m.HomeComponent),
  },
  {
    path: 'summoner/:region/:gameName/:tagLine',
    loadComponent: () => import('./pages/summoner/summoner').then((m) => m.SummonerComponent),
  },
  {
    path: 'match/:region/:matchId',
    loadComponent: () => import('./pages/match/match').then((m) => m.MatchComponent),
  },
  { path: '**', redirectTo: '' },
];
