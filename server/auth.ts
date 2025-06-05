import { randomBytes } from "crypto";
import { sendEmail } from "./email-service";
import { storage } from "./storage";

export function generateLoginToken(): string {
  return randomBytes(32).toString('hex');
}

export async function sendMagicLink(email: string, baseUrl: string): Promise<boolean> {
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
    
    // Send email
    const emailSent = await sendEmail({
      to: email,
      from: "noreply@automation-trigger.com",
      subject: "Your Login Link",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Login to Automation Trigger</h2>
          <p>Click the link below to log in to your account:</p>
          <p>
            <a href="${magicLink}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
              Log In
            </a>
          </p>
          <p>This link will expire in 15 minutes.</p>
          <p>If you didn't request this login link, you can safely ignore this email.</p>
        </div>
      `,
      text: `Login to Automation Trigger\n\nClick this link to log in: ${magicLink}\n\nThis link will expire in 15 minutes.`
    });
    
    return emailSent;
  } catch (error) {
    console.error("Error sending magic link:", error);
    return false;
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