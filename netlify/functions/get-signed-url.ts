import { Handler } from '@netlify/functions';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Re-use the dataset map that already exists in the shared loader
import { DATASETS } from './_shared/wasabi-loader';

const {
  WASABI_BUCKET = 'vibes',
  WASABI_ENDPOINT = 'https://s3.us-west-1.wasabisys.com',
  WASABI_ACCESS_KEY_ID,
  WASABI_SECRET_ACCESS_KEY,
  AWS_REGION = 'us-west-1',
} = process.env as Record<string, string | undefined>;

if (!WASABI_ACCESS_KEY_ID || !WASABI_SECRET_ACCESS_KEY) {
  console.warn('⚠️ Wasabi credentials are not set – get-signed-url function will fail');
}

const s3Client = new S3Client({
  region: AWS_REGION,
  endpoint: WASABI_ENDPOINT,
  credentials: {
    accessKeyId: WASABI_ACCESS_KEY_ID ?? '',
    secretAccessKey: WASABI_SECRET_ACCESS_KEY ?? '',
  },
  forcePathStyle: true,
});

export const handler: Handler = async (event) => {
  try {
    const datasetKey = event.queryStringParameters?.dataset || 'DBSCAN_HIERARCHICAL';
    const dataset = DATASETS[datasetKey as keyof typeof DATASETS];

    if (!dataset) {
      return { statusCode: 400, body: `Unknown dataset key: ${datasetKey}` };
    }

    const command = new GetObjectCommand({
      Bucket: WASABI_BUCKET,
      Key: dataset.path, // e.g. "datasets/dbscan_hierarchical_mcs_50-2.csv.gz"
    });

    // Signed URL valid for 15 minutes
    const url = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    };
  } catch (error: any) {
    console.error('❌ get-signed-url error:', error);
    return { statusCode: 500, body: `Internal error: ${error?.message || 'unknown'}` };
  }
}; 