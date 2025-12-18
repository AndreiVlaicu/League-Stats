import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';

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
    id: string;
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

export interface SummonerSpellData {
    id: string;
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

@Injectable({ providedIn: 'root' })
export class ChampionService {
    private http = inject(HttpClient);
    private readonly DDragon_BASE = '/champion-data';
    private readonly VERSION = '14.1.1';

    private champions$: Observable<ChampionData[]> | null = null;
    private items$: Observable<ItemData[]> | null = null;
    private summonerSpells$: Observable<SummonerSpellData[]> | null = null;

    getChampions(): Observable<ChampionData[]> {
        if (!this.champions$) {
            this.champions$ = this.http
                .get<any>(`${this.DDragon_BASE}/cdn/${this.VERSION}/data/en_US/champion.json`)
                .pipe(
                    shareReplay(1)
                );
        }
        return this.champions$;
    }

    getChampionByKey(key: string): Observable<ChampionData | undefined> {
        return new Observable<ChampionData | undefined>((observer) => {
            this.getChampions().subscribe({
                next: (data: any) => {
                    const champion = Object.values(data).find(
                        (c: any) => c.key === key
                    );
                    observer.next(champion as ChampionData | undefined);
                    observer.complete();
                },
                error: (err: any) => observer.error(err),
            });
        });
    }

    getItems(): Observable<ItemData[]> {
        if (!this.items$) {
            this.items$ = this.http
                .get<any>(`${this.DDragon_BASE}/cdn/${this.VERSION}/data/en_US/item.json`)
                .pipe(
                    shareReplay(1)
                );
        }
        return this.items$;
    }

    getSummonerSpells(): Observable<SummonerSpellData[]> {
        if (!this.summonerSpells$) {
            this.summonerSpells$ = this.http
                .get<any>(
                    `${this.DDragon_BASE}/cdn/${this.VERSION}/data/en_US/summoner.json`
                )
                .pipe(
                    shareReplay(1)
                );
        }
        return this.summonerSpells$;
    }

    getChampionImageUrl(championId: string): string {
        return `${this.DDragon_BASE}/cdn/${this.VERSION}/img/champion/${championId}.png`;
    }

    getItemImageUrl(itemId: string): string {
        return `${this.DDragon_BASE}/cdn/${this.VERSION}/img/item/${itemId}.png`;
    }

    getSummonerSpellImageUrl(spellId: string): string {
        return `${this.DDragon_BASE}/cdn/${this.VERSION}/img/spell/${spellId}.png`;
    }

    getChampionSquareImageUrl(championId: string): string {
        return `${this.DDragon_BASE}/cdn/${this.VERSION}/img/champion/square/${championId}.png`;
    }

    getPassiveImageUrl(passiveId: string): string {
        return `${this.DDragon_BASE}/cdn/${this.VERSION}/img/passive/${passiveId}.png`;
    }
}
