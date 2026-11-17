import type { Comment } from "../entities/Comment";

export interface ICommentRepository {
  findCommentById(commentId: string): Promise<Comment | null>;
}
