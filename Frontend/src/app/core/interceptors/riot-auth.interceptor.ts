import { Injectable } from '@angular/core';
import {
    HttpInterceptor,
    HttpRequest,
    HttpHandler,
    HttpEvent,
    HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable()
export class RiotAuthInterceptor implements HttpInterceptor {
    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {

        const authReq = req.clone({
            setHeaders: {
                'X-Riot-Token': environment.riotApiKey,
            },
        });

        return next.handle(authReq).pipe(
            catchError((error: HttpErrorResponse) => {
                let errorMessage = 'An error occurred';

                if (error.status === 0) {
                    errorMessage = 'Network error - Unable to reach the server';
                } else if (error.status === 400) {
                    errorMessage = 'Bad request - Invalid parameters';
                } else if (error.status === 401 || error.status === 403) {
                    errorMessage = 'Unauthorized - Invalid API Key';
                } else if (error.status === 404) {
                    errorMessage = 'Summoner not found';
                } else if (error.status === 429) {
                    errorMessage =
                        'Rate limit exceeded - Please wait a moment before trying again';
                } else if (error.status === 500) {
                    errorMessage = 'Server error - Riot API is having issues';
                } else if (error.status === 503) {
                    errorMessage = 'Service unavailable - Riot API maintenance';
                } else {
                    errorMessage = `Error ${error.status}: ${error.statusText || 'Unknown error'}`;
                }

                console.error('API Error:', error);
                return throwError(() => ({
                    status: error.status,
                    message: errorMessage,
                    originalError: error,
                }));
            })
        );
    }
}
