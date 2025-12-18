import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class RiotApiService {
  private http = inject(HttpClient);

  accountByRiotId(routing: string, gameName: string, tagLine: string) {
    return this.http.get<any>(
      `/api/riot/${routing}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
        gameName
      )}/${encodeURIComponent(tagLine)}`
    );
  }

  // Summoner (profil) - platform: euw1/eun1 etc
  summonerByPuuid(platform: string, puuid: string) {
    return this.http.get<any>(
      `/api/riot/${platform}/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`
    );
  }

  // Match IDs - routing: europe/americas etc
  matchIdsByPuuid(routing: string, puuid: string, count = 10) {
    return this.http.get<string[]>(
      `/api/riot/${routing}/lol/match/v5/matches/by-puuid/${encodeURIComponent(
        puuid
      )}/ids?start=0&count=${count}`
    );
  }

  matchById(routing: string, matchId: string) {
    return this.http.get<any>(
      `/api/riot/${routing}/lol/match/v5/matches/${encodeURIComponent(matchId)}`
    );
  }
}
