import { randomBytes } from "crypto";
import { sendEmail } from "./email-service";
import { storage } from "./storage";

export function generateLoginToken(): string {
  return randomBytes(32).toString('hex');
}

export async function sendMagicLink(email: string, baseUrl: string): Promise<{ success: boolean; magicLink?: string }> {
  try {
    // Generate unique token
    const token = generateLoginToken();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    // Save token to database
    await storage.createLoginToken({
      token,
      email,
      expiresAt,
      used: false,
    });
    
    // Create magic link
    const magicLink = `${baseUrl}/api/auth/verify?token=${token}`;
    
    // For development/demo purposes, return the magic link directly
    // In production, this would send via email
    console.log(`Magic link for ${email}: ${magicLink}`);
    
    return { success: true, magicLink };
  } catch (error) {
    console.error("Error creating magic link:", error);
    return { success: false };
  }
}

export async function verifyLoginToken(token: string): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    const tokenRecord = await storage.getLoginToken(token);
    
    if (!tokenRecord) {
      return { success: false, error: "Invalid token" };
    }
    
    if (tokenRecord.used) {
      return { success: false, error: "Token already used" };
    }
    
    if (new Date() > tokenRecord.expiresAt) {
      return { success: false, error: "Token expired" };
    }
    
    // Mark token as used
    await storage.markTokenAsUsed(token);
    
    // Get or create user
    let user = await storage.getUserByEmail(tokenRecord.email);
    if (!user) {
      user = await storage.createUser({
        email: tokenRecord.email,
        name: null,
      });
    }
    
    // Update last login
    await storage.updateUserLastLogin(user.id);
    
    return { success: true, user };
  } catch (error) {
    console.error("Error verifying token:", error);
    return { success: false, error: "Verification failed" };
  }
}