import { TestBed } from '@angular/core/testing';

import { RiotApiService } from './riot-api';

describe('RiotApiService', () => {
  let service: RiotApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RiotApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
