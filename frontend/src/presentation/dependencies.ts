import { WorkspaceService } from "../application/WorkspaceService";
import { ReviewService } from "../application/ReviewService";
import { FetchReviewApi } from "../infrastructure/http/FetchReviewApi";
import { publicEnvironment } from "../infrastructure/config/publicEnvironment";

export const reviewEnvironment = publicEnvironment();
const reviewApi = new FetchReviewApi(reviewEnvironment.apiOrigin);
export const reviewService = new ReviewService(reviewApi);

import { AuthService } from "../application/AuthService";
import { FetchAuthApi } from "../infrastructure/http/FetchAuthApi";
import { BrowserGoogleSignIn } from "../infrastructure/auth/GoogleSignIn";
export const authService = new AuthService(new FetchAuthApi(reviewEnvironment.apiOrigin), new BrowserGoogleSignIn());

export const workspaceService = new WorkspaceService(reviewApi);
