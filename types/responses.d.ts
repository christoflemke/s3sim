interface ListObjectsV2Response {
    Contents: { Key: string, LastModified: date}[]
}

interface GetObjectResponse {
    Body: string
}

interface DeleteObjectsResponse {
    Deleted: {
        Key: string,
        DeleteMarker?: boolean,
        VersionId?: string,
        DeleteMarkerVersionId?: string
    }[]
    Errors: []
}

interface ListObjectVersionsResponse {
    Versions: {
        VersionId: string,
        Key: string,
        IsLatest: boolean
    }[]
    DeleteMarkers: {
        VersionId: string,
        IsDeleted: true,
        Key: string,
        IsLatest: boolean
    }[]
}

type PutObjectResponse = S3ObjectVersion