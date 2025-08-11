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
    console.log('Getting active user, userId provided:', userId);
    console.log('Current active users:', Array.from(this.activeUsers.keys()));
    
    if (!userId) {
      // Return the most recent active user
      let mostRecent = null;
      let latestTime = 0;
      
      for (const [id, user] of this.activeUsers.entries()) {
        console.log(`Checking user ${id}, lastActivity: ${user.lastActivity}`);
        if (user.lastActivity > latestTime) {
          latestTime = user.lastActivity;
          mostRecent = user;
        }
      }
      console.log('Most recent user found:', !!mostRecent);
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
      console.log('=== AUTH MIDDLEWARE CHECK ===');
      console.log('Active users count:', this.activeUsers.size);
      
      // Try to get user from active sessions
      const activeUser = this.getActiveUser();
      console.log('Found active user:', !!activeUser);
      
      if (activeUser) {
        req.user = activeUser;
        req.isAuthenticated = () => true;
        console.log('User authenticated:', activeUser.claims.email);
        return next();
      }
      
      console.log('No active user found - authentication failed');
      return res.status(401).json({ error: "Not authenticated" });
    };
  }
}

export async function setupSimpleAuth(app: Express) {
  // Login endpoint
  app.get('/api/login', (req, res) => {
    console.log('=== LOGIN ENDPOINT CALLED ===');
    
    // Create a test user with complete data structure
    const testUser = {
      claims: {
        sub: 'test-user-123',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User'
      }
    };
    
    console.log('Setting active user:', testUser.claims.email);
    SimpleAuth.setActiveUser(testUser.claims.sub, testUser);
    
    console.log('Active users after login:', SimpleAuth.activeUsers.size);
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