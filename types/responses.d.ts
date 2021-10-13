interface ListObjectsV2Response {
  Contents: Array<{ Key: string, LastModified: Date}>
}

interface GetObjectResponse {
  Body: string
}

interface DeleteObjectsResponse {
  Deleted: Array<{
    Key: string
    DeleteMarker?: boolean
    VersionId?: string
    DeleteMarkerVersionId?: string
  }>
  Errors: []
}

interface ListObjectVersionsResponse {
  Versions: Array<{
    VersionId: string
    Key: string
    IsLatest: boolean
  }>
  DeleteMarkers: Array<{
    VersionId: string
    IsDeleted: true
    Key: string
    IsLatest: boolean
  }>
}

type PutObjectResponse = S3ObjectVersion

interface CreateBucketResponse {
  Location: string
}

interface ListBucketsResponse {
  Owner: {
    ID: string
  }
  Buckets: Array<{
    Name: string
    CreationDate: Date
  }>
}
