import { Routes } from '@angular/router';
import { MatchComponent } from './pages/match/match';
import { LiveGameComponent } from './pages/live-game/live-game';
import { SummonerByPuuidComponent } from './pages/summoner-by-puuid/summoner-by-puuid';

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
    path: 'match/:routing/:matchId/:puuid',
    loadComponent: () => import('./pages/match/match').then((m) => m.MatchComponent),
  },
  { path: 'live/:platform/:summonerId', component: LiveGameComponent },
  { path: 'summoner-puuid/:region/:puuid', component: SummonerByPuuidComponent },
  {
    path: 'favorites',
    loadComponent: () => import('./pages/favorites/favorites').then((m) => m.FavoritesComponent),
  },
  { path: '**', redirectTo: '' },
];
