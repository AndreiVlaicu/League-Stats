import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SummonerComponent } from './summoner';

describe('Summoner', () => {
  let component: SummonerComponent;
  let fixture: ComponentFixture<SummonerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SummonerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SummonerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
