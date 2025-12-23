import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home').then((m) => m.HomeComponent),
  },
  {
    path: 'summoner/:region/:gameName/:tagLine',
    loadComponent: () => import('./pages/summoner/summoner').then((m) => m.SummonerComponent),
  },
  { path: '**', redirectTo: '' },
];
