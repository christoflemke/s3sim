// Params

interface Params {
    Bucket: string
}

interface ListObjectsV2Params extends Params {
    Prefix: string
}

interface ListObjectVersionsParams extends ListObjectsV2Params {}

interface PutObjectParams extends Params {
    Key: string,
    Body: string
}

interface GetObjectParams extends Params {
    Key: string
}

interface DeleteParam {
    Key: string,
    VersionId?: string
}

interface DeleteObjectsParams extends Params {
    Delete: { Objects: DeleteParam[] }
}

// Responses

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

// Internal Representation

interface S3Bucket {
    name: string,
    objects: S3Object[]
}

interface S3Object {
    Key: string,
    LastModified: Date,
    versions: S3ObjectVersion[]
}

type S3ObjectVersion = S3DeletedObjectVersion | S3ActiveObjectVersion

interface S3DeletedObjectVersion {
    IsDeleted: true,
    VersionId: string
}

interface S3ActiveObjectVersion {
    IsDeleted: false,
    Content: string,
    VersionId: string,
    ETag: string
}