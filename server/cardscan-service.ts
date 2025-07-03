import fetch from 'node-fetch';

interface CardScanConfig {
  apiKey: string;
  baseUrl: string;
}

interface CardScanResponse {
  scan_id: string;
  status: 'processing' | 'completed' | 'failed';
  confidence: number;
  processing_time_ms?: number;
  extracted_fields?: {
    member_id?: string;
    member_name?: string;
    group_number?: string;
    plan_name?: string;
    payer_name?: string;
    rx_bin?: string;
    rx_pcn?: string;
    rx_group?: string;
    copay_er?: string;
    copay_specialist?: string;
    copay_primary_care?: string;
    deductible?: string;
    phone_member_services?: string;
    phone_pharmacy?: string;
    address?: string;
    effective_date?: string;
    plan_type?: string;
  };
  validation_results?: {
    member_id_valid: boolean;
    bin_pcn_valid: boolean;
    format_valid: boolean;
    overall_quality: 'high' | 'medium' | 'low';
  };
  raw_text?: string;
  warnings?: string[];
  errors?: string[];
}

interface CardScanFeedback {
  cardscan_confidence: number;
  openai_confidence: number;
  field_comparison: {
    matches: number;
    total_fields: number;
    accuracy_percentage: number;
  };
  validation_status: 'valid' | 'warning' | 'error';
  recommendations: string[];
  processing_time_comparison: {
    cardscan_ms: number;
    openai_ms: number;
  };
}

interface EligibilityVerificationResponse {
  eligibility_id: string;
  status: 'active' | 'inactive' | 'pending' | 'error';
  member: {
    member_id: string;
    member_name: string;
    date_of_birth?: string;
    relationship: string;
  };
  coverage: {
    effective_date: string;
    termination_date?: string;
    copays: {
      primary_care?: string;
      specialist?: string;
      emergency_room?: string;
    };
    deductible?: {
      individual: string;
      family?: string;
      remaining?: string;
    };
    out_of_pocket_max?: {
      individual: string;
      family?: string;
      remaining?: string;
    };
  };
  benefits: {
    medical_benefits: boolean;
    prescription_benefits: boolean;
    dental_benefits?: boolean;
    vision_benefits?: boolean;
  };
  payer_info: {
    payer_name: string;
    payer_id: string;
    group_number?: string;
    plan_name?: string;
  };
  verification_details: {
    verified_at: string;
    verification_source: string;
    confidence_score: number;
    warnings?: string[];
    errors?: string[];
  };
}

class CardScanService {
  private config: CardScanConfig;

  constructor() {
    this.config = {
      apiKey: process.env.CARDSCAN_API_KEY || '',
      baseUrl: 'https://api.cardscan.ai/v1'
    };
  }

  async scanInsuranceCard(imageBase64: string): Promise<CardScanResponse> {
    if (!this.config.apiKey) {
      throw new Error('CardScan.ai API key not configured');
    }

    const startTime = Date.now();

    try {
      const response = await fetch(`${this.config.baseUrl}/cards/scan`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: imageBase64,
          options: {
            extract_all_fields: true,
            validate_data: true,
            return_raw_text: true,
            timeout_seconds: 30
          }
        })
      });

      if (!response.ok) {
        throw new Error(`CardScan.ai API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as CardScanResponse;
      const processingTime = Date.now() - startTime;
      
      return {
        ...result,
        processing_time_ms: processingTime
      };

    } catch (error) {
      console.error('CardScan.ai API error:', error);
      throw new Error(`CardScan.ai processing failed: ${error.message}`);
    }
  }

  async compareWithOpenAI(
    cardScanResult: CardScanResponse, 
    openAIResult: any,
    openAIProcessingTime: number
  ): Promise<CardScanFeedback> {
    const feedback: CardScanFeedback = {
      cardscan_confidence: cardScanResult.confidence || 0,
      openai_confidence: openAIResult.metadata?.ocr_confidence?.overall || 0,
      field_comparison: {
        matches: 0,
        total_fields: 0,
        accuracy_percentage: 0
      },
      validation_status: 'valid',
      recommendations: [],
      processing_time_comparison: {
        cardscan_ms: cardScanResult.processing_time_ms || 0,
        openai_ms: openAIProcessingTime
      }
    };

    // Compare key fields between CardScan and OpenAI results
    const fieldMappings = {
      member_id: openAIResult.member?.member_id,
      member_name: openAIResult.member?.subscriber_name,
      group_number: openAIResult.insurer?.group_number,
      plan_name: openAIResult.insurer?.plan_name,
      payer_name: openAIResult.insurer?.name,
      rx_bin: openAIResult.pharmacy?.bin,
      rx_pcn: openAIResult.pharmacy?.pcn,
      rx_group: openAIResult.pharmacy?.rx_group,
      copay_er: openAIResult.cost_share?.er_copay,
      copay_specialist: openAIResult.cost_share?.specialist_copay,
      copay_primary_care: openAIResult.cost_share?.pcp_copay,
      phone_member_services: openAIResult.contact?.customer_service_phone,
      phone_pharmacy: openAIResult.pharmacy?.pharmacy_phone
    };

    let matches = 0;
    let totalComparisons = 0;

    for (const [cardScanField, openAIValue] of Object.entries(fieldMappings)) {
      const cardScanValue = cardScanResult.extracted_fields?.[cardScanField as keyof typeof cardScanResult.extracted_fields];
      
      if (cardScanValue && openAIValue) {
        totalComparisons++;
        
        // Normalize values for comparison (remove spaces, convert to lowercase)
        const normalizedCardScan = String(cardScanValue).replace(/\s+/g, '').toLowerCase();
        const normalizedOpenAI = String(openAIValue).replace(/\s+/g, '').toLowerCase();
        
        if (normalizedCardScan === normalizedOpenAI) {
          matches++;
        }
      }
    }

    feedback.field_comparison = {
      matches,
      total_fields: totalComparisons,
      accuracy_percentage: totalComparisons > 0 ? Math.round((matches / totalComparisons) * 100) : 0
    };

    // Generate recommendations based on comparison
    if (feedback.field_comparison.accuracy_percentage >= 90) {
      feedback.validation_status = 'valid';
      feedback.recommendations.push('Excellent data extraction quality from both services');
    } else if (feedback.field_comparison.accuracy_percentage >= 70) {
      feedback.validation_status = 'warning';
      feedback.recommendations.push('Good extraction quality with minor discrepancies');
      feedback.recommendations.push('Consider manual review of differing fields');
    } else {
      feedback.validation_status = 'error';
      feedback.recommendations.push('Significant discrepancies detected between services');
      feedback.recommendations.push('Manual review strongly recommended');
      feedback.recommendations.push('Consider re-scanning with better image quality');
    }

    // Add confidence-based recommendations
    if (feedback.cardscan_confidence < 0.8 || feedback.openai_confidence < 0.8) {
      feedback.recommendations.push('Low confidence detected - consider re-uploading with better lighting');
    }

    // Add processing time recommendations
    if (feedback.processing_time_comparison.cardscan_ms > feedback.processing_time_comparison.openai_ms * 2) {
      feedback.recommendations.push('CardScan.ai processing slower than expected');
    } else if (feedback.processing_time_comparison.openai_ms > feedback.processing_time_comparison.cardscan_ms * 2) {
      feedback.recommendations.push('OpenAI Vision processing slower than expected');
    }

    // Include CardScan validation results
    if (cardScanResult.validation_results) {
      if (!cardScanResult.validation_results.member_id_valid) {
        feedback.recommendations.push('Member ID format validation failed');
        feedback.validation_status = 'error';
      }
      if (!cardScanResult.validation_results.bin_pcn_valid) {
        feedback.recommendations.push('BIN/PCN validation failed');
        feedback.validation_status = 'error';
      }
      if (cardScanResult.validation_results.overall_quality === 'low') {
        feedback.recommendations.push('CardScan.ai reports low image quality');
      }
    }

    return feedback;
  }

  async verifyEligibility(cardData: {
    member_id: string;
    member_name: string;
    dob?: string;
    group_number?: string;
    bin?: string;
    pcn?: string;
    payer_name?: string;
  }): Promise<EligibilityVerificationResponse> {
    if (!this.config.apiKey) {
      throw new Error('CardScan.ai API key not configured');
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/v1/eligibility/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          member_id: cardData.member_id,
          member_name: cardData.member_name,
          date_of_birth: cardData.dob,
          group_number: cardData.group_number,
          bin: cardData.bin,
          pcn: cardData.pcn,
          payer_name: cardData.payer_name,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`CardScan.ai eligibility verification failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('CardScan.ai eligibility verification error:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.config.apiKey) {
      return false;
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        }
      });
      return response.ok;
    } catch (error) {
      console.error('CardScan.ai health check failed:', error);
      return false;
    }
  }
}

export const cardScanService = new CardScanService();
export type { CardScanResponse, CardScanFeedback };