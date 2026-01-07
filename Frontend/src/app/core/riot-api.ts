import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SummonerData {
  id: string;
  accountId: string;
  puuid: string;
  name: string;
  profileIconId: number;
  revisionDate: number;
  summonerLevel: number;
}

export interface RankData {
  summonerId: string;
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  hotStreak: boolean;
  veteran: boolean;
  freshBlood: boolean;
  inactive: boolean;
}

export interface AccountData {
  puuid: string;
  gameName: string;
  tagLine: string;
}

@Injectable({ providedIn: 'root' })
export class RiotApiService {
  private http = inject(HttpClient);

  private readonly BASE = '/api/riot';

  accountByRiotId(routing: string, gameName: string, tagLine: string): Observable<AccountData> {
    return this.http.get<AccountData>(
      `${this.BASE}/${routing}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
        gameName
      )}/${encodeURIComponent(tagLine)}`
    );
  }

  accountByPuuid(routing: string, puuid: string): Observable<AccountData> {
    return this.http.get<AccountData>(
      `${this.BASE}/${routing}/riot/account/v1/accounts/by-puuid/${encodeURIComponent(puuid)}`
    );
  }

  summonerByPuuid(platform: string, puuid: string): Observable<SummonerData> {
    return this.http.get<SummonerData>(
      `${this.BASE}/${platform}/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`
    );
  }

  summonerBySummonerId(platform: string, summonerId: string): Observable<SummonerData> {
    return this.http.get<SummonerData>(
      `${this.BASE}/${platform}/lol/summoner/v4/summoners/${encodeURIComponent(summonerId)}`
    );
  }

  getRankBySummonerId(platform: string, summonerId: string): Observable<RankData[]> {
    return this.http.get<RankData[]>(
      `${this.BASE}/${platform}/lol/league/v4/entries/by-summoner/${encodeURIComponent(summonerId)}`
    );
  }

  getLeagueEntriesByQueue(
    platform: string,
    queue: string,
    tier: string,
    division: string,
    page = 1
  ): Observable<RankData[]> {
    return this.http.get<RankData[]>(
      `${this.BASE}/${platform}/lol/league/v4/entries/${encodeURIComponent(
        queue
      )}/${encodeURIComponent(tier)}/${encodeURIComponent(division)}?page=${page}`
    );
  }

  matchIdsByPuuid(routing: string, puuid: string, start = 0, count = 20): Observable<string[]> {
    return this.http.get<string[]>(
      `${this.BASE}/${routing}/lol/match/v5/matches/by-puuid/${encodeURIComponent(
        puuid
      )}/ids?start=${start}&count=${count}`
    );
  }

  matchById(routing: string, matchId: string): Observable<any> {
    return this.http.get<any>(
      `${this.BASE}/${routing}/lol/match/v5/matches/${encodeURIComponent(matchId)}`
    );
  }

  matchTimelineById(routing: string, matchId: string): Observable<any> {
    return this.http.get<any>(
      `${this.BASE}/${routing}/lol/match/v5/matches/${encodeURIComponent(matchId)}/timeline`
    );
  }

  getCurrentGame(platform: string, summonerId: string): Observable<any> {
    return this.http.get<any>(
      `${this.BASE}/${platform}/lol/spectator/v5/active-games/by-summoner/${encodeURIComponent(
        summonerId
      )}`
    );
  }

  getCurrentGameByPuuid(platform: string, puuid: string): Observable<any> {
    return this.http.get<any>(
      `${this.BASE}/${platform}/lol/spectator/v5/active-games/by-summoner/${encodeURIComponent(
        puuid
      )}`
    );
  }

  getChampionMasteries(platform: string, summonerId: string): Observable<any[]> {
    return this.http.get<any[]>(
      `${
        this.BASE
      }/${platform}/lol/champion-mastery/v4/champion-masteries/by-summoner/${encodeURIComponent(
        summonerId
      )}`
    );
  }

  getChampionMasteriesByPuuid(platform: string, puuid: string): Observable<any[]> {
    return this.http.get<any[]>(
      `${
        this.BASE
      }/${platform}/lol/champion-mastery/v4/champion-masteries/by-puuid/${encodeURIComponent(
        puuid
      )}`
    );
  }

  getTopChampionMasteries(platform: string, puuid: string, count: number = 3): Observable<any[]> {
    return this.http.get<any[]>(
      `${
        this.BASE
      }/${platform}/lol/champion-mastery/v4/champion-masteries/by-puuid/${encodeURIComponent(
        puuid
      )}/top?count=${count}`
    );
  }

  getChampionMasteryBySummonerId(
    platform: string,
    summonerId: string,
    championId: number
  ): Observable<any> {
    return this.http.get<any>(
      `${
        this.BASE
      }/${platform}/lol/champion-mastery/v4/champion-masteries/by-summoner/${encodeURIComponent(
        summonerId
      )}/by-champion/${championId}`
    );
  }
}
