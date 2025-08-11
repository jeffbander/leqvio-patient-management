import type { Express, RequestHandler } from "express";
import { storage } from "./storage";

// Simple token-based authentication
export class SimpleAuth {
  private static activeUsers = new Map<string, any>();
  
  static setActiveUser(userId: string, userData: any) {
    this.activeUsers.set(userId, {
      ...userData,
      lastActivity: Date.now()
    });
    console.log(`User ${userId} set as active`);
  }
  
  static getActiveUser(userId?: string): any {
    if (!userId) {
      // Return the most recent active user
      let mostRecent = null;
      let latestTime = 0;
      
      for (const [id, user] of this.activeUsers.entries()) {
        if (user.lastActivity > latestTime) {
          latestTime = user.lastActivity;
          mostRecent = user;
        }
      }
      return mostRecent;
    }
    
    const user = this.activeUsers.get(userId);
    if (user) {
      // Update last activity
      user.lastActivity = Date.now();
    }
    return user;
  }
  
  static clearActiveUser(userId: string) {
    this.activeUsers.delete(userId);
  }
  
  static isAuthenticated(): RequestHandler {
    return async (req: any, res, next) => {
      // Try to get user from active sessions
      const activeUser = this.getActiveUser();
      
      if (activeUser) {
        req.user = activeUser;
        req.isAuthenticated = () => true;
        return next();
      }
      
      return res.status(401).json({ error: "Not authenticated" });
    };
  }
}

export async function setupSimpleAuth(app: Express) {
  // Login endpoint
  app.get('/api/login', (req, res) => {
    // For now, simulate login with a test user
    const testUser = {
      claims: {
        sub: 'test-user-123',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User'
      }
    };
    
    SimpleAuth.setActiveUser(testUser.claims.sub, testUser);
    
    res.redirect('/');
  });
  
  // Logout endpoint
  app.get('/api/logout', (req, res) => {
    const activeUser = SimpleAuth.getActiveUser();
    if (activeUser) {
      SimpleAuth.clearActiveUser(activeUser.claims.sub);
    }
    res.redirect('/');
  });
}

export const isAuthenticated = SimpleAuth.isAuthenticated();