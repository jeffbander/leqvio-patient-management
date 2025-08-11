// Simple initialization script to set up Mount Sinai organization
import { db } from './server/db.js';
import { organizations, organizationMembers, patients } from './shared/schema.js';

async function initializeMountSinai() {
  console.log('Initializing Mount Sinai organization...');
  
  try {
    // Create Mount Sinai organization
    const [mountSinaiOrg] = await db
      .insert(organizations)
      .values({ name: 'Mount Sinai' })
      .onConflictDoNothing()
      .returning();
    
    console.log('Mount Sinai organization:', mountSinaiOrg);
    
    if (mountSinaiOrg) {
      // Update all existing patients to belong to Mount Sinai
      const result = await db
        .update(patients)
        .set({ organizationId: mountSinaiOrg.id })
        .where(sql`organization_id IS NULL`);
      
      console.log('Updated existing patients to Mount Sinai organization');
    }
    
    console.log('Setup completed successfully!');
  } catch (error) {
    console.error('Setup error:', error);
  }
}

initializeMountSinai();