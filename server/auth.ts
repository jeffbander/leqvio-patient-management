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
    
    // Send magic link via email
    const emailSent = await sendEmail({
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL || "noreply@yourdomain.com",
      subject: "Your LEQVIO Login Link",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c5aa0;">LEQVIO Patient Management</h2>
          <p>Click the link below to log in to your account:</p>
          <a href="${magicLink}" style="display: inline-block; background-color: #2c5aa0; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 16px 0;">
            Log In to LEQVIO
          </a>
          <p style="color: #666; font-size: 14px;">This link will expire in 15 minutes.</p>
          <p style="color: #666; font-size: 12px;">If you didn't request this login link, you can safely ignore this email.</p>
        </div>
      `,
      text: `Log in to LEQVIO Patient Management: ${magicLink}\n\nThis link will expire in 15 minutes.`
    });
    
    if (!emailSent) {
      console.error("Failed to send magic link email");
      return { success: false };
    }
    
    // Also log to console for development
    console.log(`Magic link sent to ${email}: ${magicLink}`);
    
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
        password: "magic_link_auth", // Placeholder for magic link authentication
      });
      
      // Auto-assign new users to default organization
      try {
        await storage.assignUserToDefaultOrganization(user.id);
      } catch (error) {
        console.warn("Failed to assign user to default organization:", error);
      }
    }
    
    // Update last login
    await storage.updateUserLastLogin(user.id);
    
    return { success: true, user };
  } catch (error) {
    console.error("Error verifying token:", error);
    return { success: false, error: "Verification failed" };
  }
}