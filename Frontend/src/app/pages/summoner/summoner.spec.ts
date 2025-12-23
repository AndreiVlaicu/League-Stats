import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Summoner } from './summoner';

describe('Summoner', () => {
  let component: Summoner;
  let fixture: ComponentFixture<Summoner>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Summoner]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Summoner);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
