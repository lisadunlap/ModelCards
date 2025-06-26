import { Handler } from '@netlify/functions';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Re-use the dataset map that already exists in the shared loader
import { DATASETS } from './_shared/wasabi-loader';

export const handler: Handler = async (event) => {
  console.log('🚀 === get-signed-url function started ===');
  
  try {
    // Log ALL environment variables (mask sensitive parts)
    const {
      WASABI_BUCKET = 'vibes',
      WASABI_ENDPOINT = 'https://s3.us-west-1.wasabisys.com',
      WASABI_ACCESS_KEY_ID,
      WASABI_SECRET_ACCESS_KEY,
      WASABI_REGION = 'us-west-1',
    } = process.env as Record<string, string | undefined>;

    console.log('🔧 Environment check:', {
      WASABI_BUCKET,
      WASABI_ENDPOINT,
      WASABI_REGION,
      hasAccessKey: !!WASABI_ACCESS_KEY_ID,
      hasSecretKey: !!WASABI_SECRET_ACCESS_KEY,
      accessKeyLength: WASABI_ACCESS_KEY_ID?.length || 0,
      secretKeyLength: WASABI_SECRET_ACCESS_KEY?.length || 0,
      accessKeyStart: WASABI_ACCESS_KEY_ID?.substring(0, 4) + '...',
    });

    if (!WASABI_ACCESS_KEY_ID || !WASABI_SECRET_ACCESS_KEY) {
      console.error('❌ Missing credentials');
      return { statusCode: 500, body: 'Missing Wasabi credentials' };
    }

    // Log request details
    console.log('📥 Request details:', {
      httpMethod: event.httpMethod,
      path: event.path,
      queryStringParameters: event.queryStringParameters,
      headers: Object.keys(event.headers || {}),
    });

    const datasetKey = event.queryStringParameters?.dataset || 'DBSCAN_HIERARCHICAL';
    console.log(`🎯 Dataset key requested: ${datasetKey}`);

    // Log available datasets
    console.log('📂 Available datasets:', Object.keys(DATASETS));

    const dataset = DATASETS[datasetKey as keyof typeof DATASETS];
    if (!dataset) {
      console.error(`❌ Unknown dataset key: ${datasetKey}`);
      console.log('❌ Available keys are:', Object.keys(DATASETS));
      return { statusCode: 400, body: `Unknown dataset key: ${datasetKey}` };
    }

    console.log('📋 Selected dataset config:', {
      key: datasetKey,
      path: dataset.path,
      label: dataset.label,
      description: dataset.description,
    });

    // Create S3 client with extensive logging
    console.log('🔨 Creating S3 client with config:', {
      region: WASABI_REGION,
      endpoint: WASABI_ENDPOINT,
      forcePathStyle: true,
      useAccelerateEndpoint: false,
      useDualstackEndpoint: false,
    });

    const s3Client = new S3Client({
      region: WASABI_REGION,
      endpoint: WASABI_ENDPOINT,
      credentials: {
        accessKeyId: WASABI_ACCESS_KEY_ID!,
        secretAccessKey: WASABI_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true,
      useAccelerateEndpoint: false,
      useDualstackEndpoint: false,
    });

    console.log('✅ S3 client created successfully');

    // Log command details
    const commandConfig = {
      Bucket: WASABI_BUCKET,
      Key: dataset.path,
    };
    console.log('📝 GetObjectCommand config:', commandConfig);

    const command = new GetObjectCommand(commandConfig);
    console.log('✅ GetObjectCommand created');

    // Log signing parameters
    const signingParams = { 
      expiresIn: 3600,
      unhoistableHeaders: new Set<string>(),
    };
    console.log('🔐 Signing parameters:', signingParams);

    console.log('⏳ Generating signed URL...');
    const startTime = Date.now();
    
    const url = await getSignedUrl(s3Client, command, signingParams);
    
    const endTime = Date.now();
    console.log(`⚡ URL generation took: ${endTime - startTime}ms`);

    // Comprehensive URL analysis
    console.log('🔗 === SIGNED URL ANALYSIS ===');
    console.log('🔗 Full URL:', url);
    console.log('🔗 URL length:', url.length);
    console.log('🔗 URL starts with:', url.substring(0, 100));
    console.log('🔗 Contains bucket in path:', url.includes(`/${WASABI_BUCKET}/`));
    console.log('🔗 Contains bucket in hostname:', url.includes(`${WASABI_BUCKET}.`));
    console.log('🔗 Starts with endpoint:', url.startsWith(WASABI_ENDPOINT));
    console.log('🔗 Contains dataset path:', url.includes(dataset.path));
    console.log('🔗 Has AWS signature:', url.includes('X-Amz-Signature'));
    console.log('🔗 Has credentials:', url.includes('X-Amz-Credential'));
    console.log('🔗 Has algorithm:', url.includes('X-Amz-Algorithm'));
    
    // Parse URL to show structure
    try {
      const parsedUrl = new URL(url);
      console.log('🔗 URL structure:', {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        pathname: parsedUrl.pathname,
        searchParamsCount: parsedUrl.searchParams.size,
      });
    } catch (urlError) {
      console.error('❌ Failed to parse URL:', urlError);
    }

    // Create response
    const response = {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({ url }),
    };

    console.log('📤 Response being returned:', {
      statusCode: response.statusCode,
      headers: response.headers,
      bodyLength: response.body.length,
    });

    console.log('✅ === Function completed successfully ===');
    return response;

  } catch (error: any) {
    console.error('💥 === FUNCTION ERROR ===');
    console.error('❌ Error type:', error.constructor.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error stack:', error.stack);
    
    if (error.$metadata) {
      console.error('❌ AWS SDK metadata:', error.$metadata);
    }
    
    return { 
      statusCode: 500, 
      headers: { 'Content-Type': 'text/plain' },
      body: `Internal error: ${error?.message || 'unknown'}` 
    };
  }
}; 