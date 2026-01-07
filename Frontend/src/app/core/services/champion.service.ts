import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, shareReplay, switchMap, tap } from 'rxjs';

export interface ChampionData {
  id: string;
  key: string;
  name: string;
  title: string;
  image: {
    full: string;
    sprite: string;
    group: string;
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

export interface ItemData {
  name: string;
  description: string;
  image: {
    full: string;
    sprite: string;
    group: string;
    x: number;
    y: number;
    w: number;
    h: number;
  };
  id?: string;
}

export interface SummonerSpellData {
  id: string;
  key: string;
  name: string;
  description: string;
  image: {
    full: string;
    sprite: string;
    group: string;
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

type DDragonChampionsResponse = {
  data: Record<string, ChampionData>;
  version?: string;
};

type DDragonItemsResponse = {
  data: Record<string, ItemData>;
  version?: string;
};

type DDragonSummonerSpellsResponse = {
  data: Record<string, SummonerSpellData>;
  version?: string;
};

@Injectable({ providedIn: 'root' })
export class ChampionService {
  private http = inject(HttpClient);

  private readonly BASE = '/champion-data';

  private readonly FALLBACK_VERSION = '14.1.1';

  private versionValue: string = this.FALLBACK_VERSION;

  private version$?: Observable<string>;
  private championsResp$?: Observable<DDragonChampionsResponse>;
  private itemsResp$?: Observable<DDragonItemsResponse>;
  private spellsResp$?: Observable<DDragonSummonerSpellsResponse>;

  getVersion(): Observable<string> {
    if (!this.version$) {
      this.version$ = this.http.get<string[]>(`${this.BASE}/api/versions.json`).pipe(
        map((versions) => versions?.[0] ?? this.FALLBACK_VERSION),
        tap((v) => (this.versionValue = v)),
        catchError(() => {
          this.versionValue = this.FALLBACK_VERSION;
          return of(this.FALLBACK_VERSION);
        }),
        shareReplay(1)
      );
    }
    return this.version$;
  }

  getVersionSync(): string {
    return this.versionValue;
  }

  private getChampionsResp(): Observable<DDragonChampionsResponse> {
    if (!this.championsResp$) {
      this.championsResp$ = this.getVersion().pipe(
        switchMap((ver) =>
          this.http.get<DDragonChampionsResponse>(
            `${this.BASE}/cdn/${ver}/data/en_US/champion.json`
          )
        ),
        tap((resp) => {
          if (resp?.version) this.versionValue = resp.version;
        }),
        catchError(() => of({ data: {} })),
        shareReplay(1)
      );
    }
    return this.championsResp$;
  }

  getChampions(): Observable<ChampionData[]> {
    return this.getChampionsResp().pipe(map((resp) => Object.values(resp.data ?? {})));
  }

  getChampionsByKey(): Observable<Record<string, ChampionData>> {
    return this.getChampionsResp().pipe(
      map((resp) => {
        const out: Record<string, ChampionData> = {};
        for (const c of Object.values(resp.data ?? {})) out[c.key] = c;
        return out;
      }),
      shareReplay(1)
    );
  }

  getChampionsById(): Observable<Record<string, ChampionData>> {
    return this.getChampionsResp().pipe(
      map((resp) => resp.data ?? {}),
      shareReplay(1)
    );
  }

  getChampionByKey(key: string): Observable<ChampionData | undefined> {
    return this.getChampionsByKey().pipe(map((m) => m[key]));
  }

  private getItemsResp(): Observable<DDragonItemsResponse> {
    if (!this.itemsResp$) {
      this.itemsResp$ = this.getVersion().pipe(
        switchMap((ver) =>
          this.http.get<DDragonItemsResponse>(`${this.BASE}/cdn/${ver}/data/en_US/item.json`)
        ),
        tap((resp) => {
          if (resp?.version) this.versionValue = resp.version;
        }),
        catchError(() => of({ data: {} })),
        shareReplay(1)
      );
    }
    return this.itemsResp$;
  }

  getItems(): Observable<ItemData[]> {
    return this.getItemsResp().pipe(
      map((resp) => Object.entries(resp.data ?? {}).map(([id, it]) => ({ ...it, id })))
    );
  }

  getItemsById(): Observable<Record<string, ItemData>> {
    return this.getItemsResp().pipe(
      map((resp) => {
        const out: Record<string, ItemData> = {};
        for (const [id, it] of Object.entries(resp.data ?? {})) out[id] = { ...it, id };
        return out;
      }),
      shareReplay(1)
    );
  }

  private getSummonerSpellsResp(): Observable<DDragonSummonerSpellsResponse> {
    if (!this.spellsResp$) {
      this.spellsResp$ = this.getVersion().pipe(
        switchMap((ver) =>
          this.http.get<DDragonSummonerSpellsResponse>(
            `${this.BASE}/cdn/${ver}/data/en_US/summoner.json`
          )
        ),
        tap((resp) => {
          if (resp?.version) this.versionValue = resp.version;
        }),
        catchError(() => of({ data: {} })),
        shareReplay(1)
      );
    }
    return this.spellsResp$;
  }

  getSummonerSpells(): Observable<SummonerSpellData[]> {
    return this.getSummonerSpellsResp().pipe(map((resp) => Object.values(resp.data ?? {})));
  }

  getSummonerSpellsByKey(): Observable<Record<string, SummonerSpellData>> {
    return this.getSummonerSpellsResp().pipe(
      map((resp) => {
        const out: Record<string, SummonerSpellData> = {};
        for (const s of Object.values(resp.data ?? {})) out[s.key] = s;
        return out;
      }),
      shareReplay(1)
    );
  }

  getChampionImageUrl(championId: string, version?: string): string {
    const v = version ?? this.versionValue;
    return `${this.BASE}/cdn/${v}/img/champion/${championId}.png`;
  }

  getItemImageUrl(itemId: string | number, version?: string): string {
    const v = version ?? this.versionValue;
    const id = String(itemId);
    if (!id || id === '0') return '';
    return `${this.BASE}/cdn/${v}/img/item/${id}.png`;
  }

  getSummonerSpellImageUrl(spellId: string, version?: string): string {
    const v = version ?? this.versionValue;
    return `${this.BASE}/cdn/${v}/img/spell/${spellId}.png`;
  }

  championSquareUrlByNumericKeySync(
    championKey: number | string,
    championsByKey: Record<string, ChampionData>,
    version?: string
  ): string {
    const v = version ?? this.versionValue;
    const champ = championsByKey[String(championKey)];
    if (!champ) return '';
    return `${this.BASE}/cdn/${v}/img/champion/${champ.image.full}`;
  }

  spellIconUrlByNumericKeySync(
    spellKey: number | string,
    spellsByKey: Record<string, SummonerSpellData>,
    version?: string
  ): string {
    const v = version ?? this.versionValue;
    const sp = spellsByKey[String(spellKey)];
    if (!sp) return '';
    return `${this.BASE}/cdn/${v}/img/spell/${sp.image.full}`;
  }

  spellNameByNumericKeySync(
    spellKey: number | string,
    spellsByKey: Record<string, SummonerSpellData>
  ): string {
    return spellsByKey[String(spellKey)]?.name ?? '';
  }

  championNameByNumericKeySync(
    championKey: number | string,
    championsByKey: Record<string, ChampionData>
  ): string {
    return championsByKey[String(championKey)]?.name ?? '';
  }

  getChampionSquareImageUrl(championId: string, version?: string): string {
    return this.getChampionImageUrl(championId, version);
  }

  getPassiveImageUrl(passiveFilename: string, version?: string): string {
    const v = version ?? this.versionValue;
    return `${this.BASE}/cdn/${v}/img/passive/${passiveFilename}`;
  }
}
